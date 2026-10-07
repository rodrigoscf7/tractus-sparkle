import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/estados";
import { CarrosselSlide } from "@/components/CarrosselSlide";
import { BotaoCarrossel } from "@/components/roteiro/BotaoCarrossel";
import { useConta } from "@/hooks/use-conta";
import { useFontesCarrossel } from "@/hooks/use-fontes-carrossel";
import {
  FOTO_BUCKET,
  IMAGEM_BUCKET,
  imagemAsDataUrl,
  mergeSlides,
  parseTemplate,
  type CarrosselRow,
} from "@/lib/carrossel-template";
import { dataCurta, diaDaSemana } from "@/lib/datas";
import { STATUS_COM_ROTEIRO } from "@/lib/roteiro";

export const Route = createFileRoute("/_authenticated/carrosseis")({
  head: () => ({
    meta: [
      { title: "Carrosséis | prevIA - CONTENT" },
      {
        name: "description",
        content: "Os carrosséis prontos para baixar e os roteiros que ainda podem virar carrossel.",
      },
      { property: "og:title", content: "Carrosséis | prevIA - CONTENT" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: CarrosseisPage,
});

type Carrossel = CarrosselRow & {
  pauta_id: string | null;
  atualizado_em: string;
  pautas_geradas: { id: string; tema: string | null; data_prevista: string | null } | null;
  perfis: { template_carrossel: unknown } | null;
};

type RoteiroSemCarrossel = {
  id: string;
  tema: string | null;
  data_prevista: string | null;
  carrosseis: { id: string }[];
};

/** A mesma foto de perfil serve a todos os cartões: cada arquivo baixa uma vez por página. */
const arquivos = new Map<string, Promise<string>>();
function arquivoEmCache(bucket: string, caminho: string) {
  const chave = `${bucket}:${caminho}`;
  if (!arquivos.has(chave)) arquivos.set(chave, imagemAsDataUrl(bucket, caminho));
  return arquivos.get(chave)!;
}

function CarrosseisPage() {
  const { data: conta } = useConta();
  const contaId = conta?.conta?.id as string | undefined;

  const carrosseis = useQuery({
    queryKey: ["carrosseis", contaId],
    enabled: Boolean(contaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("carrosseis")
        .select(
          "id, status, erro, copy, visual, pauta_id, atualizado_em, imagem_capa_path, imagem_capa_foco, pautas_geradas:pautas_geradas(id, tema, data_prevista), perfis:perfis(template_carrossel)",
        )
        .eq("conta_id", contaId as string)
        .order("atualizado_em", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Carrossel[];
    },
  });

  const semCarrossel = useQuery({
    queryKey: ["roteiros-sem-carrossel", contaId],
    enabled: Boolean(contaId),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pautas_geradas")
        .select("id, tema, data_prevista, carrosseis(id)")
        .eq("conta_id", contaId as string)
        .in("status", [...STATUS_COM_ROTEIRO])
        .order("data_prevista", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as unknown as RoteiroSemCarrossel[]).filter(
        (p) => p.carrosseis.length === 0,
      );
    },
  });

  // Carrossel gerando em outra tela: o cartão troca sozinho quando fica pronto.
  useEffect(() => {
    if (!contaId) return;
    const canal = supabase
      .channel("carrosseis-tela")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "carrosseis", filter: `conta_id=eq.${contaId}` },
        () => {
          carrosseis.refetch();
          semCarrossel.refetch();
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(canal);
    };
  }, [contaId]); // eslint-disable-line react-hooks/exhaustive-deps

  const carregando = !contaId || carrosseis.isLoading || semCarrossel.isLoading;
  const erro = carrosseis.isError || semCarrossel.isError;
  const lista = carrosseis.data ?? [];
  const pendentes = semCarrossel.data ?? [];

  return (
    <div className="p-4 sm:p-8 max-w-[1400px] space-y-8">
      <header>
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Carrosséis</h1>
        <p className="text-muted-foreground text-sm mt-1 max-w-[62ch]">
          Cada carrossel sai de um roteiro, escrito para ser lido: capa que prende, uma ideia por
          slide e um fechamento que vale salvar. A aparência segue o seu template.
        </p>
      </header>

      {carregando && !erro && <EstadoCarregando linhas={3} rotulo="Carregando os carrosséis" />}

      {erro && (
        <EstadoErro
          titulo="Não consegui carregar os carrosséis"
          descricao="A conexão falhou no meio do caminho. Nenhum carrossel foi perdido."
          onTentarDeNovo={() => {
            carrosseis.refetch();
            semCarrossel.refetch();
          }}
        />
      )}

      {!carregando && !erro && lista.length === 0 && pendentes.length === 0 && (
        <EstadoVazio
          titulo="Nenhum carrossel ainda"
          descricao="Os carrosséis saem dos seus roteiros. Assim que um roteiro estiver escrito, ele aparece aqui para virar carrossel."
          acao={
            <Button asChild>
              <Link to="/roteiros">Ver meus roteiros</Link>
            </Button>
          }
        />
      )}

      {!carregando && !erro && lista.length > 0 && (
        <section aria-labelledby="titulo-prontos">
          <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
            <h2 id="titulo-prontos" className="font-display font-bold text-lg">
              Seus carrosséis
            </h2>
            <Link
              to="/configuracoes"
              search={{ aba: "carrossel" }}
              className="text-sm text-muted-foreground underline underline-offset-2 hover:text-foreground"
            >
              Mudar a aparência
            </Link>
          </div>
          <div className="grid gap-4 [grid-template-columns:repeat(auto-fill,minmax(15rem,1fr))]">
            {lista.map((c) => (
              <CartaoCarrossel key={c.id} carrossel={c} />
            ))}
          </div>
        </section>
      )}

      {!carregando && !erro && pendentes.length > 0 && (
        <section aria-labelledby="titulo-pendentes">
          <h2 id="titulo-pendentes" className="font-display font-bold text-lg">
            Roteiros que ainda podem virar carrossel
          </h2>
          <p className="text-sm text-muted-foreground mt-1 mb-3">
            Não precisa aprovar o roteiro antes. Leva até dois minutos por carrossel.
          </p>
          <ul className="divide-y divide-divider rounded-xl border border-border bg-surface">
            {pendentes.map((p) => (
              <li
                key={p.id}
                className="flex flex-wrap items-center justify-between gap-3 px-4 py-3"
              >
                <div className="min-w-0 flex items-center gap-3">
                  {p.data_prevista && <SeloDia iso={p.data_prevista} />}
                  <Link
                    to="/aprovacao/$pautaId"
                    params={{ pautaId: p.id }}
                    className="font-medium leading-snug hover:underline underline-offset-2 min-w-0"
                  >
                    {p.tema ?? "(sem tema)"}
                  </Link>
                </div>
                <BotaoCarrossel pautaId={p.id} status={null} />
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function SeloDia({ iso }: { iso: string }) {
  return (
    <span className="inline-flex shrink-0 items-baseline gap-1.5 rounded-md bg-foreground px-2 py-1 text-background">
      <span className="font-display text-xs font-bold capitalize">{diaDaSemana(iso)}</span>
      <span className="font-mono text-[11px] opacity-75 num">{dataCurta(iso)}</span>
    </span>
  );
}

/** A capa de verdade, no template do perfil: a pessoa reconhece o post antes de abrir. */
function CartaoCarrossel({ carrossel }: { carrossel: Carrossel }) {
  const template = parseTemplate(carrossel.perfis?.template_carrossel);
  const slides = mergeSlides(carrossel);
  const pauta = carrossel.pautas_geradas;
  const [foto, setFoto] = useState("");
  const [imagem, setImagem] = useState("");
  // Sem a fonte carregada, a capa piscaria na fonte do sistema.
  const fontes = useFontesCarrossel(template.fonte_titulo, template.fonte_texto);

  useEffect(() => {
    if (template.foto_path) arquivoEmCache(FOTO_BUCKET, template.foto_path).then(setFoto);
  }, [template.foto_path]);

  const caminhoImagem = carrossel.imagem_capa_path;
  useEffect(() => {
    if (caminhoImagem) arquivoEmCache(IMAGEM_BUCKET, caminhoImagem).then(setImagem);
    else setImagem("");
  }, [caminhoImagem]);

  const pronto = carrossel.status === "pronto" && slides.length > 0;

  return (
    <Card className="overflow-hidden bg-surface border-border flex flex-col">
      <div className="grid place-items-center bg-muted py-5 min-h-[310px]">
        {pronto ? (
          <div className={fontes.pronto ? "" : "opacity-0"}>
            <CarrosselSlide
              slide={slides[0]}
              template={template}
              fotoDataUrl={foto}
              index={0}
              total={slides.length}
              scale={0.2}
              imagemCapa={
                caminhoImagem && imagem
                  ? { dataUrl: imagem, foco: carrossel.imagem_capa_foco ?? 50 }
                  : null
              }
            />
          </div>
        ) : carrossel.status === "erro" ? (
          <p className="flex flex-col items-center gap-2 px-6 text-center text-sm text-muted-foreground">
            <AlertCircle className="w-5 h-5 text-destructive" />
            Não saiu desta vez.
          </p>
        ) : (
          <p className="flex flex-col items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="w-5 h-5 animate-spin motion-reduce:animate-none" />
            Gerando carrossel…
          </p>
        )}
      </div>

      <div className="p-4 flex flex-col gap-2 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          {pauta?.data_prevista && <SeloDia iso={pauta.data_prevista} />}
          {pronto && (
            <span className="text-xs text-muted-foreground num">{slides.length} slides</span>
          )}
        </div>
        <h3 className="font-display font-semibold leading-snug">{pauta?.tema ?? "(sem tema)"}</h3>
        <div className="mt-auto pt-2 flex flex-wrap items-center gap-2">
          {pauta && pronto && (
            <Button size="sm" variant="outline" asChild>
              <Link to="/aprovacao/$pautaId" params={{ pautaId: pauta.id }} hash="carrossel">
                Ver e baixar <ArrowRight className="w-4 h-4 ml-1" />
              </Link>
            </Button>
          )}
          {pauta && carrossel.status === "erro" && (
            <BotaoCarrossel pautaId={pauta.id} status="erro" />
          )}
        </div>
      </div>
    </Card>
  );
}
