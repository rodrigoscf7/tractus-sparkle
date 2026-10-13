// email-agent: e-mails de marca do funil, enviados pela API do Resend.
//
// Dois tipos, os dois montados aqui a partir do banco — quem chama passa só
// identificadores, nunca o texto, para esta função não virar um relay de
// e-mail arbitrário:
//   - dna_viral:   { tipo, lead_id }         link permanente do relatório.
//   - boas_vindas: { tipo, email, lead_id? } pós-compra, com link para criar
//                  a senha (link de recuperação gerado pelo Auth).
//
// E-mail de infraestrutura (esqueci minha senha) não passa por aqui: sai do
// Supabase Auth pelo SMTP do Resend.
import {
  corsHeaders,
  formatAgentError,
  getServiceClient,
  requireAgentAuth,
} from "../_shared/agent-utils.ts";

type Pedido =
  | { tipo: "dna_viral"; lead_id: string }
  | { tipo: "boas_vindas"; email: string; lead_id?: string | null };

type Lead = {
  id: string;
  token: string;
  nome: string | null;
  email: string | null;
  relatorio: { arquetipo?: { nome?: string } | null } | null;
};

const UUID = /^[0-9a-f-]{36}$/i;

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function siteUrl(): string {
  const url = Deno.env.get("SITE_URL");
  if (!url) throw new Error("SITE_URL ausente nos secrets das Edge Functions.");
  return url.replace(/\/+$/, "");
}

function escapar(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function primeiroNome(nome: string | null | undefined): string {
  return String(nome ?? "").trim().split(/\s+/)[0] ?? "";
}

function arquetipoDe(lead: Lead | null): string | null {
  const nome = lead?.relatorio?.arquetipo?.nome;
  return typeof nome === "string" && nome.trim() ? nome.trim() : null;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

/** Botão em tabela: é o que o Outlook respeita. */
function botao(href: string, rotulo: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:28px 0"><tr><td style="background:#F4DB0B;border-radius:6px">
<a href="${escapar(href)}" style="display:inline-block;padding:14px 28px;font:600 16px/1 Inter,Arial,sans-serif;color:#1F1F1F;text-decoration:none">${escapar(rotulo)}</a>
</td></tr></table>`;
}

function paragrafo(html: string): string {
  return `<p style="margin:0 0 16px;font:16px/1.6 Inter,Arial,sans-serif;color:#3A3A3A">${html}</p>`;
}

function moldura(conteudo: string, site: string): string {
  return `<!doctype html><html lang="pt-BR"><body style="margin:0;background:#F6F5F0">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border:1px solid #E6E4DC;border-radius:10px">
<tr><td style="padding:32px 32px 8px"><img src="${site}/logo-fundo-claro.png" alt="prevIA" height="28" style="height:28px;width:auto;border:0"></td></tr>
<tr><td style="padding:16px 32px 32px">${conteudo}</td></tr>
</table>
<p style="margin:16px 0 0;font:12px/1.5 Inter,Arial,sans-serif;color:#8A877C">prevIA · <a href="${site}/privacidade" style="color:#8A877C">Política de Privacidade</a></p>
</td></tr></table></body></html>`;
}

// ---------------------------------------------------------------------------
// Envio
// ---------------------------------------------------------------------------

async function enviar(opts: {
  para: string;
  assunto: string;
  html: string;
  texto: string;
  idempotencia: string;
}) {
  const chave = Deno.env.get("RESEND_API_KEY");
  const remetente = Deno.env.get("EMAIL_REMETENTE");
  // O remetente é do subdomínio de envio, que não recebe e-mail. Sem isto, a
  // resposta de um cliente (comum no pós-compra) voltaria como não entregue.
  const responderPara = Deno.env.get("EMAIL_RESPONDER_PARA");
  if (!chave || !remetente) {
    throw new Error("RESEND_API_KEY ou EMAIL_REMETENTE ausente nos secrets das Edge Functions.");
  }

  const resp = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${chave}`,
      "Content-Type": "application/json",
      // O Resend descarta a segunda chamada com a mesma chave em 24h.
      "Idempotency-Key": opts.idempotencia,
    },
    body: JSON.stringify({
      from: remetente,
      ...(responderPara ? { reply_to: responderPara } : {}),
      to: [opts.para],
      subject: opts.assunto,
      html: opts.html,
      text: opts.texto,
    }),
  });

  if (!resp.ok) {
    const corpo = await resp.text().catch(() => "");
    throw new Error(`Resend respondeu ${resp.status}: ${corpo.slice(0, 300)}`);
  }
  const dados = (await resp.json().catch(() => ({}))) as { id?: string };
  return dados.id ?? null;
}

async function lerLead(supabase: ReturnType<typeof getServiceClient>, id: string) {
  const { data } = await supabase
    .from("oferta_leads")
    .select("id, token, nome, email, relatorio")
    .eq("id", id)
    .maybeSingle();
  return (data ?? null) as Lead | null;
}

// ---------------------------------------------------------------------------
// dna_viral
// ---------------------------------------------------------------------------

async function enviarDnaViral(leadId: string) {
  if (!UUID.test(leadId)) return json({ ok: false, error: "lead_id inválido" }, 400);
  const supabase = getServiceClient();

  // Carimba antes de enviar: duas chamadas juntas, só uma passa daqui.
  const { data: reservado } = await supabase
    .from("oferta_leads")
    .update({ email_enviado_em: new Date().toISOString() })
    .eq("id", leadId)
    .is("email_enviado_em", null)
    .not("email", "is", null)
    .not("relatorio", "is", null)
    .select("id")
    .maybeSingle();

  if (!reservado) return json({ ok: true, enviado: false, motivo: "ja_enviado_ou_incompleto" });

  const lead = await lerLead(supabase, leadId);
  try {
    if (!lead?.email) throw new Error("Lead sem e-mail.");

    const site = siteUrl();
    const link = `${site}/dna-viral/${lead.token}`;
    const nome = primeiroNome(lead.nome);
    const arquetipo = arquetipoDe(lead);

    const assunto = arquetipo
      ? `${nome ? `${nome}, seu` : "Seu"} DNA Viral: ${arquetipo}`
      : `${nome ? `${nome}, seu` : "Seu"} diagnóstico de conteúdo está guardado aqui`;

    const abertura = arquetipo
      ? `Seu perfil saiu como <strong>${escapar(arquetipo)}</strong>. O diagnóstico completo está no link abaixo, para você voltar quando quiser.`
      : "O seu diagnóstico de conteúdo está no link abaixo, para você voltar quando quiser.";

    const html = moldura(
      paragrafo(nome ? `Oi, ${escapar(nome)}.` : "Oi.") +
        paragrafo(abertura) +
        botao(link, "Abrir meu diagnóstico") +
        paragrafo(
          "Lá estão os gargalos que travam o seu perfil, os seus pilares de autoridade e os 3 roteiros prontos para gravar hoje. Dá para baixar em PDF.",
        ) +
        paragrafo("Grave o primeiro ainda esta semana. A estrutura já está montada; falta a sua voz."),
      site,
    );

    const texto = [
      nome ? `Oi, ${nome}.` : "Oi.",
      arquetipo
        ? `Seu perfil saiu como ${arquetipo}. O diagnóstico completo está aqui:`
        : "O seu diagnóstico de conteúdo está aqui:",
      link,
      "Lá estão os gargalos, os seus pilares de autoridade e os 3 roteiros prontos para gravar hoje.",
    ].join("\n\n");

    const id = await enviar({
      para: lead.email,
      assunto,
      html,
      texto,
      idempotencia: `dna-viral/${lead.id}`,
    });
    return json({ ok: true, enviado: true, id });
  } catch (e) {
    // Desfaz o carimbo para uma próxima tentativa poder enviar.
    await supabase.from("oferta_leads").update({ email_enviado_em: null }).eq("id", leadId);
    throw e;
  }
}

// ---------------------------------------------------------------------------
// boas_vindas
// ---------------------------------------------------------------------------

async function enviarBoasVindas(email: string, leadId: string | null | undefined) {
  const para = email.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(para)) {
    return json({ ok: false, error: "e-mail inválido" }, 400);
  }

  const supabase = getServiceClient();
  const site = siteUrl();

  // Link de recuperação: cobre quem fechou a aba antes de criar a senha, quem
  // pagou em outro aparelho e quem comprou sem passar pelo quiz.
  const { data: gerado, error } = await supabase.auth.admin.generateLink({
    type: "recovery",
    email: para,
    options: { redirectTo: `${site}/redefinir-senha` },
  });
  if (error) throw new Error(`Falha ao gerar o link de acesso: ${error.message}`);
  const linkSenha = gerado?.properties?.action_link;
  if (!linkSenha) throw new Error("O Auth não devolveu o link de acesso.");

  const lead = leadId && UUID.test(leadId) ? await lerLead(supabase, leadId) : null;
  const nome = primeiroNome(lead?.nome);
  const arquetipo = arquetipoDe(lead);
  const linkRelatorio = lead?.token && lead.relatorio ? `${site}/dna-viral/${lead.token}` : null;

  const assunto = arquetipo
    ? `${nome ? `${nome}, o` : "O"} ${arquetipo} agora tem conteúdo toda semana`
    : `${nome ? `${nome}, sua` : "Sua"} prevIA está pronta — falta só a senha`;

  const blocoDiagnostico =
    linkRelatorio && arquetipo
      ? paragrafo(
          `O ponto de partida é o seu diagnóstico, <strong>${escapar(arquetipo)}</strong>. Ele continua <a href="${escapar(linkRelatorio)}" style="color:#1F1F1F">neste link</a>, e as suas respostas já estão dentro da conta.`,
        )
      : linkRelatorio
        ? paragrafo(
            `O seu diagnóstico continua <a href="${escapar(linkRelatorio)}" style="color:#1F1F1F">neste link</a>, e as suas respostas já estão dentro da conta.`,
          )
        : "";

  const html = moldura(
    paragrafo(nome ? `Oi, ${escapar(nome)}.` : "Oi.") +
      paragrafo("Pagamento confirmado. A sua conta na prevIA já existe neste e-mail.") +
      paragrafo("Para entrar, crie a sua senha:") +
      botao(linkSenha, "Criar minha senha") +
      blocoDiagnostico +
      paragrafo(
        "Depois de entrar, falta pouco: confirmar o cadastro (que já vem preenchido com o que você respondeu) e indicar os perfis do Instagram que você usa de referência. A partir daí, o plano da semana chega todo domingo, com o roteiro de cada vídeo pronto.",
      ) +
      paragrafo(
        `Se você já criou a senha na página de obrigado, é só <a href="${site}/auth" style="color:#1F1F1F">entrar</a>. Se o botão acima tiver expirado, use "Esqueci minha senha" na tela de entrar.`,
      ),
    site,
  );

  const texto = [
    nome ? `Oi, ${nome}.` : "Oi.",
    "Pagamento confirmado. A sua conta na prevIA já existe neste e-mail.",
    `Crie a sua senha: ${linkSenha}`,
    linkRelatorio ? `Seu diagnóstico: ${linkRelatorio}` : "",
    "Depois de entrar, confirme o cadastro (já vem preenchido) e indique os perfis de referência.",
    `Se já criou a senha, entre em ${site}/auth. Se o link expirou, use "Esqueci minha senha".`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const id = await enviar({
    para,
    assunto,
    html,
    texto,
    idempotencia: `boas-vindas/${para}`,
  });
  return json({ ok: true, enviado: true, id });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const authError = await requireAgentAuth(req);
  if (authError) return authError;

  try {
    const pedido = (await req.json()) as Pedido;
    if (pedido?.tipo === "dna_viral") return await enviarDnaViral(String(pedido.lead_id ?? ""));
    if (pedido?.tipo === "boas_vindas") {
      return await enviarBoasVindas(String(pedido.email ?? ""), pedido.lead_id ?? null);
    }
    return json({ ok: false, error: "tipo desconhecido" }, 400);
  } catch (e) {
    console.error("email-agent:", e);
    return json({ ok: false, error: formatAgentError(e) }, 500);
  }
});
