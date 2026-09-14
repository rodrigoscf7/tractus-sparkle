import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { QuizOferta } from "@/components/oferta/QuizOferta";
import { TOTAL_PASSOS } from "@/lib/quiz-oferta";
import { VARIANTE_ATIVA } from "@/lib/oferta-variante";

/**
 * A página de oferta. É a única rota do app renderizada no servidor e aberta
 * ao público — todo o resto ou está sob `_authenticated`, ou é `/auth` e
 * `/onboarding`, que rodam com `ssr: false`.
 *
 * Aqui o SSR é obrigatório e não é detalhe: é a página que recebe tráfego pago.
 * Precisa de primeiro paint rápido, precisa que o robô do anúncio leia as meta
 * tags e precisa existir em HTML para o preview do link. Não coloque
 * `ssr: false` nesta rota.
 *
 * Os passos vão na query (`/?passo=2`), não em rotas separadas, porque o teste
 * A/B contra a LP compara duas páginas na MESMA URL. URL única mantém a
 * atribuição do anúncio limpa e evita um redirect na página que mais custa caro.
 */
export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      // Sobrescreve o title/description de produto que o __root define. O que
      // está lá descreve a ferramenta para quem já é cliente; aqui a leitora
      // ainda não sabe o que é isto.
      { title: "prevIA — título provisório da oferta" },
      {
        name: "description",
        content: "Descrição provisória da oferta. Entra junto com a copy.",
      },
      { property: "og:title", content: "prevIA — título provisório da oferta" },
      {
        property: "og:description",
        content: "Descrição provisória da oferta. Entra junto com a copy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      // Ao contrário do onboarding, esta página quer ser indexada.
      { name: "robots", content: "index, follow" },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { passo?: number } => {
    const bruto = Number(search.passo ?? 0);
    const passo = Number.isFinite(bruto) ? Math.trunc(bruto) : 0;
    const limitado = Math.min(TOTAL_PASSOS, Math.max(0, passo));
    return limitado === 0 ? {} : { passo: limitado };
  },
  component: Oferta,
});

function Oferta() {
  const { passo = 0 } = Route.useSearch();

  useDesviarQuemJaEntrou();

  // O ponto de troca do teste A/B. Quando a LP existir, é esta linha que
  // decide — e o braço precisa vir do servidor, não do cliente (ver
  // `lib/oferta-variante.ts`).
  if (VARIANTE_ATIVA === "quiz") return <QuizOferta passo={passo} />;
  return <QuizOferta passo={passo} />;
}

/**
 * Quem já tem sessão não deveria ver a página de venda: manda para o app.
 *
 * Isso é feito no cliente, e não em `beforeLoad`, porque o servidor não tem
 * como saber. A sessão do Supabase vive no localStorage do navegador
 * (`persistSession` no client.ts) e as server functions só recebem o token
 * porque o cliente anexa o header — não existe cookie de sessão para o SSR ler.
 *
 * O custo é um flash da oferta para quem está logado e digita `/`. É um caminho
 * raro: o app instalado abre em `/hoje` (start_url do manifest) e é para lá que
 * vão os atalhos. O contrário — desligar o SSR da página de venda para evitar o
 * flash — sairia muito mais caro.
 */
function useDesviarQuemJaEntrou() {
  const navigate = useNavigate();

  useEffect(() => {
    let cancelado = false;

    supabase.auth.getSession().then(({ data }) => {
      if (cancelado || !data.session) return;
      navigate({ to: "/hoje", replace: true });
    });

    return () => {
      cancelado = true;
    };
  }, [navigate]);
}
