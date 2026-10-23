import { createFileRoute } from "@tanstack/react-router";
import { PaginaLegal, SecaoLegal } from "@/components/legal/PaginaLegal";
import { EMPRESA } from "@/lib/legal";

/**
 * Política de Privacidade. Pública e renderizada no servidor: o Meta exige a
 * URL para anúncios que coletam contato, e o robô dele precisa ler o HTML.
 *
 * Texto-base para revisão jurídica. Quem mudar o que o quiz coleta, um
 * fornecedor ou o rastreamento precisa atualizar esta página junto.
 */
export const Route = createFileRoute("/privacidade")({
  head: () => ({
    meta: [
      { title: "Política de Privacidade | prevIA" },
      { name: "description", content: "Como a prevIA trata os seus dados pessoais." },
    ],
  }),
  component: Privacidade,
});

function Privacidade() {
  return (
    <PaginaLegal titulo="Política de Privacidade">
      <SecaoLegal titulo="Quem somos">
        <p>
          A prevIA é operada por {EMPRESA.razaoSocial} ({EMPRESA.nomeFantasia}), inscrita no CNPJ{" "}
          {EMPRESA.cnpj}, com sede em {EMPRESA.endereco} ("prevIA", "nós"). Somos a controladora dos
          dados pessoais tratados no diagnóstico de conteúdo e no aplicativo, nos termos da Lei
          Geral de Proteção de Dados (Lei nº 13.709/2018, "LGPD").
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="Quais dados coletamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>
            <strong className="text-foreground">No diagnóstico (quiz):</strong> nome, e-mail,
            WhatsApp e as respostas sobre a sua atuação profissional e a sua produção de conteúdo.
          </li>
          <li>
            <strong className="text-foreground">Na compra:</strong> e-mail e dados do pedido
            enviados pela plataforma de pagamento. Dados de cartão não passam por nós.
          </li>
          <li>
            <strong className="text-foreground">No aplicativo:</strong> dados da conta, as
            informações de perfil e voz que você preenche, os perfis públicos do Instagram que você
            indica como referência e o conteúdo gerado para você.
          </li>
          <li>
            <strong className="text-foreground">Navegação:</strong> parâmetros de campanha (UTM),
            identificadores de clique de anúncio e eventos de navegação registrados pelo Meta Pixel
            nas páginas do diagnóstico. Para limitar abuso, guardamos um código derivado do seu
            endereço IP, nunca o IP em si.
          </li>
        </ul>
      </SecaoLegal>

      <SecaoLegal titulo="Para que usamos">
        <ul className="list-disc space-y-2 pl-5">
          <li>Gerar e entregar o seu diagnóstico, inclusive por e-mail.</li>
          <li>
            Criar e manter a sua conta depois da compra, com as respostas do diagnóstico já
            aproveitadas no cadastro.
          </li>
          <li>Prestar o serviço contratado: planos semanais, roteiros e carrosséis.</li>
          <li>
            Enviar comunicações relacionadas ao diagnóstico e ao serviço, por e-mail ou WhatsApp.
            Você pode pedir para parar a qualquer momento.
          </li>
          <li>Medir o desempenho dos nossos anúncios e melhorar o diagnóstico.</li>
          <li>Cumprir obrigações legais e nos defender em processos.</li>
        </ul>
        <p>
          As bases legais são a execução de contrato e de procedimentos preliminares a ele (art. 7º,
          V), o legítimo interesse (art. 7º, IX), o cumprimento de obrigação legal (art. 7º, II) e,
          para comunicações de marketing, o seu consentimento (art. 7º, I).
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="Com quem compartilhamos">
        <p>
          Não vendemos dados pessoais. Compartilhamos apenas com fornecedores que operam o serviço
          em nosso nome:
        </p>
        <ul className="list-disc space-y-2 pl-5">
          <li>Supabase e Railway: banco de dados e hospedagem do aplicativo.</li>
          <li>Hubla: processamento de pagamentos e assinaturas.</li>
          <li>Resend: envio de e-mails.</li>
          <li>
            Provedores de modelos de inteligência artificial (via OpenRouter): geração do
            diagnóstico e do conteúdo a partir das suas respostas.
          </li>
          <li>Apify: leitura de publicações públicas dos perfis de referência que você indica.</li>
          <li>Meta Platforms: medição de anúncios pelo Meta Pixel.</li>
        </ul>
        <p>
          Alguns desses fornecedores processam dados fora do Brasil. Nesses casos, a transferência
          segue o art. 33 da LGPD, com cláusulas contratuais e garantias de proteção adequadas.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="Por quanto tempo guardamos">
        <p>
          Dados de quem respondeu o diagnóstico e não comprou ficam guardados por até 24 meses
          depois da última interação. Dados de clientes ficam enquanto a conta existir e, depois,
          pelo prazo exigido por lei. Você pode pedir a exclusão antes disso.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="Seus direitos">
        <p>
          Você pode, a qualquer momento, pedir confirmação de que tratamos seus dados, acesso,
          correção, anonimização, portabilidade, exclusão, informação sobre compartilhamento e
          revogação do consentimento (art. 18 da LGPD). Basta escrever para{" "}
          {EMPRESA.emailEncarregado}. Respondemos em até 15 dias.
        </p>
        <p>Você também pode reclamar à Autoridade Nacional de Proteção de Dados (ANPD).</p>
      </SecaoLegal>

      <SecaoLegal titulo="Cookies e rastreamento">
        <p>
          As páginas do diagnóstico usam o Meta Pixel para saber quais anúncios trouxeram visitas,
          cadastros e compras. Você pode bloquear esse rastreamento nas configurações do seu
          navegador ou nas preferências de anúncios da sua conta Meta. O aplicativo, depois do
          login, não usa o Pixel.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="Segurança">
        <p>
          Usamos conexão criptografada, controle de acesso por conta e acesso restrito aos dados
          pela equipe. Nenhum sistema é infalível; se houver um incidente que traga risco a você,
          avisaremos você e a ANPD.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="Contato">
        <p>
          Encarregado pelo tratamento de dados: {EMPRESA.encarregado} — {EMPRESA.emailEncarregado}.
          Outros assuntos: {EMPRESA.emailContato}.
        </p>
      </SecaoLegal>
    </PaginaLegal>
  );
}
