import { createFileRoute, Link } from "@tanstack/react-router";
import { PaginaLegal, SecaoLegal } from "@/components/legal/PaginaLegal";
import { EMPRESA } from "@/lib/legal";

/**
 * Termos de Uso. Texto-base para revisão jurídica; preço, limites e regras de
 * cancelamento aqui precisam bater com a oferta e com o manual do assistente
 * (supabase/functions/_shared/ajuda.ts).
 */
export const Route = createFileRoute("/termos")({
  head: () => ({
    meta: [
      { title: "Termos de Uso | prevIA" },
      { name: "description", content: "As regras de uso da prevIA." },
    ],
  }),
  component: Termos,
});

function Termos() {
  return (
    <PaginaLegal titulo="Termos de Uso">
      <SecaoLegal titulo="1. Sobre estes termos">
        <p>
          Estes termos regem o uso do diagnóstico de conteúdo e do aplicativo prevIA, operados por{" "}
          {EMPRESA.razaoSocial}, CNPJ {EMPRESA.cnpj}. Ao responder o diagnóstico ou assinar, você
          concorda com eles e com a{" "}
          <Link to="/privacidade" className="text-foreground underline underline-offset-4">
            Política de Privacidade
          </Link>
          .
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="2. O serviço">
        <p>
          A prevIA analisa publicações públicas dos perfis de referência que você indica e, com
          inteligência artificial, sugere um plano semanal de vídeos, roteiros e carrosséis na sua
          voz. O diagnóstico gratuito é uma leitura das suas respostas, não uma auditoria do seu
          perfil.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="3. Conteúdo gerado e responsabilidade profissional">
        <p>
          O conteúdo é gerado por inteligência artificial e pode conter imprecisões. Antes de
          publicar, você é responsável por revisá-lo e por garantir que ele respeita o Código de
          Ética e Disciplina da OAB e o Provimento nº 205/2021 sobre publicidade na advocacia. A
          prevIA não presta consultoria jurídica.
        </p>
        <p>
          O conteúdo gerado para você é seu e pode ser usado livremente. A prevIA não copia
          publicações de terceiros: usa a estrutura do que performa como referência.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="4. Assinatura, pagamento e limites">
        <p>
          A assinatura é mensal, cobrada e renovada automaticamente pela Hubla. Cada plano tem
          limites mensais de geração, informados na oferta e em Configurações › Assinatura, que
          reiniciam no dia 1 de cada mês.
        </p>
        <p>
          Sem assinatura ativa, a conta continua acessível para consulta, mas não gera conteúdo
          novo.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="5. Cancelamento e reembolso">
        <p>
          Você pode cancelar a qualquer momento, sem multa; o acesso vale até o fim do período já
          pago. Pelo direito de arrependimento (art. 49 do Código de Defesa do Consumidor), você
          pode pedir reembolso integral em até 7 dias após a primeira compra. Para cancelar ou pedir
          reembolso, fale com o suporte em {EMPRESA.emailContato}.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="6. Uso adequado">
        <p>
          A conta é pessoal. Não é permitido compartilhar o acesso, automatizar o uso, tentar
          contornar os limites ou usar o serviço para gerar conteúdo ilícito, enganoso ou que viole
          direitos de terceiros. Podemos suspender contas que descumpram estas regras.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="7. Disponibilidade">
        <p>
          Trabalhamos para manter o serviço no ar, mas ele depende de fornecedores externos (como o
          Instagram e os provedores de IA) e pode ter instabilidades. Nossa responsabilidade se
          limita ao valor pago nos últimos 3 meses, exceto onde a lei não permitir essa limitação.
        </p>
      </SecaoLegal>

      <SecaoLegal titulo="8. Mudanças e foro">
        <p>
          Podemos atualizar estes termos; mudanças relevantes serão avisadas no aplicativo ou por
          e-mail. Fica eleito o foro de {EMPRESA.foro}, sem prejuízo do foro do domicílio do
          consumidor.
        </p>
      </SecaoLegal>
    </PaginaLegal>
  );
}
