import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TemplateCarrosselEditor } from "@/components/TemplateCarrosselEditor";
import { useConta } from "@/hooks/use-conta";
import { useIsPlatformAdmin } from "@/hooks/use-platform-admin";
import { EstadoCarregando, EstadoErro, EstadoVazio } from "@/components/estados";
import { mensagemErro } from "@/lib/mensagem-erro";
import { nomeStatusPauta } from "@/lib/vocabulario";
import { linhasParaLista } from "@/lib/onboarding-perguntas";


export const Route = createFileRoute("/_authenticated/perfis")({
  head: () => ({
    meta: [
      { title: "Perfis e diretrizes | prevIA - CONTENT" },
      {
        name: "description",
        content:
          "Configure tom de voz, CTA padrão, foco de curadoria e identidade visual de cada perfil.",
      },
      { property: "og:title", content: "Perfis e diretrizes | prevIA - CONTENT" },
      { property: "og:description", content: "Parâmetros que orientam os agentes de conteúdo." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PerfisPage,
});

const STATUS_ORDER = ["gerada", "em_producao", "aguardando_aprovacao", "aprovada", "rejeitada"];

const ROTULO_CAMPO =
  "block text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-1.5";

function PerfisPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [novoHandle, setNovoHandle] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("cliente");
  const [criando, setCriando] = useState(false);
  const { data: conta } = useConta();
  const { data: isAdmin } = useIsPlatformAdmin();

  const {
    data: perfis,
    refetch: refetchPerfis,
    isLoading: carregandoPerfis,
    isError: erroPerfis,
  } = useQuery({
    queryKey: ["perfis-all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("perfis").select("*").order("tipo").order("nome");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: pautas } = useQuery({
    queryKey: ["perfis-pautas"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pautas_geradas")
        .select("id, perfil_id, status, tema");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: refs, refetch: refetchRefs } = useQuery({
    queryKey: ["perfis-refs", activeId],
    queryFn: async () => {
      if (!activeId) return [];
      const { data, error } = await supabase
        .from("perfis_referencia")
        .select("*")
        .eq("perfil_id_relacionado", activeId);
      if (error) throw error;
      return data ?? [];
    },
    enabled: !!activeId,
  });

  const active = perfis?.find((p) => p.id === activeId);

  // Assinante solo tem um perfil só: abrir o editor não deveria custar um clique.
  useEffect(() => {
    if (!activeId && perfis?.length === 1) setActiveId(perfis[0].id);
  }, [perfis, activeId]);

  async function addReferencia() {
    if (!activeId || !novoHandle.trim()) return;
    const handle = novoHandle.replace(/^@/, "").trim();
    const { error } = await supabase.from("perfis_referencia").insert({
      handle,
      perfil_id_relacionado: activeId,
      conta_id: perfis?.find((p) => p.id === activeId)?.conta_id ?? null,
    });
    if (error) {
      toast.error(mensagemErro(error, "Não consegui adicionar essa referência."));
      return;
    }
    setNovoHandle("");
    refetchRefs();
    toast.success(`@${handle} adicionado.`);
  }

  async function removeRef(id: string) {
    await supabase.from("perfis_referencia").delete().eq("id", id);
    refetchRefs();
  }

  async function criarPerfil() {
    const nome = novoNome.trim();
    if (!nome) {
      toast.error("Informe o nome do perfil.");
      return;
    }
    const contaId = conta?.conta?.id ?? null;
    if (!contaId) {
      toast.error("Conta ainda carregando. Tente novamente em instantes.");
      return;
    }
    setCriando(true);
    const { data, error } = await supabase
      .from("perfis")
      .insert({ nome, tipo: novoTipo, conta_id: contaId })
      .select("id")
      .single();
    setCriando(false);
    if (error) {
      toast.error(mensagemErro(error, "Não consegui criar o perfil."));
      return;
    }
    setNovoNome("");
    await refetchPerfis();
    setActiveId(data?.id ?? null);
    toast.success(`Perfil "${nome}" criado.`);
  }

  return (
    <div className="p-4 sm:p-8 max-w-[1400px]">
      <header className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Minha marca</h1>
        <p className="text-muted-foreground text-sm mt-1">
          O que a prevIA usa para escrever no seu lugar: sua voz, seus limites e os perfis que ela
          acompanha em busca de assunto.
        </p>
      </header>

      {/*
       * Criar perfil é operação de quem atende vários advogados. O assinante solo
       * recebe o perfil pronto do onboarding e nunca precisa de um segundo.
       */}
      {isAdmin && (
        <Card className="p-5 bg-surface border-border mb-8">
          <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Criar novo perfil
          </h2>
          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={novoNome}
              onChange={(e) => setNovoNome(e.target.value)}
              aria-label="Nome do novo perfil"
              placeholder="Nome do perfil (ex: Márcia Canuto)"
              onKeyDown={(e) => e.key === "Enter" && criarPerfil()}
            />
            <Select value={novoTipo} onValueChange={setNovoTipo}>
              <SelectTrigger className="sm:w-[200px]" aria-label="Tipo do perfil">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="cliente">Cliente</SelectItem>
                <SelectItem value="socio">Sócio</SelectItem>
                <SelectItem value="institucional">Institucional</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={criarPerfil} disabled={criando}>
              {criando ? "Criando…" : "Criar perfil"}
            </Button>
          </div>
        </Card>
      )}

      {carregandoPerfis && <EstadoCarregando linhas={2} rotulo="Carregando os perfis" />}

      {erroPerfis && (
        <EstadoErro
          titulo="Não consegui carregar os perfis"
          descricao="A conexão falhou no meio do caminho. Nada foi perdido."
          onTentarDeNovo={() => refetchPerfis()}
        />
      )}

      {!carregandoPerfis && !erroPerfis && perfis?.length === 0 && (
        <EstadoVazio
          className="mb-8"
          titulo="Nenhum perfil por aqui"
          descricao={
            isAdmin
              ? "Crie o primeiro acima para configurar voz, fechamento e as referências que a prevIA acompanha."
              : "Seu perfil nasce no onboarding. Se ele não aparecer aqui, fale com o suporte."
          }
        />
      )}

      {/* Com um perfil só não há o que escolher: o editor abre direto abaixo. */}
      <div
        className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8 ${
          (perfis?.length ?? 0) <= 1 ? "hidden" : ""
        }`}
      >
        {perfis?.map((perfil) => {
          const ps = (pautas ?? []).filter((x) => x.perfil_id === perfil.id);
          const isActive = perfil.id === activeId;
          return (
            <Card
              key={perfil.id}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onClick={() => setActiveId(isActive ? null : perfil.id)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setActiveId(isActive ? null : perfil.id);
                }
              }}
              className={`p-5 bg-surface border-border cursor-pointer transition motion-reduce:transition-none hover:border-primary/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                isActive ? "border-primary" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold truncate">{perfil.nome}</h3>
                  <Badge variant="outline" className="mt-1 text-[11px] uppercase font-mono">
                    {perfil.tipo}
                  </Badge>
                </div>
                <div className="text-2xl font-display font-semibold num shrink-0">
                  {ps.length}
                </div>
              </div>
              <div className="space-y-1.5 mt-4">
                {STATUS_ORDER.map((s) => {
                  const n = ps.filter((p) => p.status === s).length;
                  if (n === 0) return null;
                  return (
                    <div key={s} className="flex justify-between gap-3 text-xs">
                      <span className="text-muted-foreground">{nomeStatusPauta(s)}</span>
                      <span className="font-mono num">{n}</span>
                    </div>
                  );
                })}
              </div>
            </Card>
          );
        })}
      </div>

      {active && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <IdentityEditor
            key={active.id}
            perfil={active}
            onSaved={() => refetchPerfis()}
          />

          <TemplateCarrosselEditor
            key={`tpl-${active.id}`}
            perfilId={active.id}
            perfilNome={active.nome}
            templateRaw={(active as { template_carrossel?: unknown }).template_carrossel}
            onSaved={() => refetchPerfis()}
          />




          <Card className="p-6 bg-surface border-border">
            <h2 className="font-display font-semibold text-lg mb-1">Onde buscar repertório</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Perfis do Instagram que a prevIA lê toda manhã atrás de assunto. Ela nunca copia —
              usa como matéria-prima para escrever com a sua voz.
            </p>
            <div className="flex gap-2 mb-4">
              <Input
                value={novoHandle}
                onChange={(e) => setNovoHandle(e.target.value)}
                aria-label="Perfil do Instagram para acompanhar"
                placeholder="@handle.instagram"
                onKeyDown={(e) => e.key === "Enter" && addReferencia()}
              />
              <Button onClick={addReferencia}>Adicionar</Button>
            </div>
            <div className="space-y-2">
              {refs?.length === 0 && (
                <p className="text-sm text-muted-foreground">
                  Nenhum perfil ainda. Sem pelo menos um, a prevIA não tem onde buscar assunto.
                </p>
              )}
              {refs?.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 p-3 rounded border border-border bg-background"
                >
                  <span className="font-mono text-sm">@{r.handle}</span>
                  <div className="flex items-center gap-2">
                    <Select
                      value={
                        (r as { foco_curadoria?: string | null }).foco_curadoria ?? "herdar"
                      }
                      onValueChange={async (v) => {
                        const { error } = await supabase
                          .from("perfis_referencia")
                          .update({ foco_curadoria: v === "herdar" ? null : v })
                          .eq("id", r.id);
                        if (error) toast.error(mensagemErro(error, "Não consegui salvar o foco."));
                        else refetchRefs();
                      }}
                    >
                      <SelectTrigger className="h-8 w-[190px] text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="herdar">Herdar do perfil</SelectItem>
                        <SelectItem value="viral">Foco viral</SelectItem>
                        <SelectItem value="posicionamento">Foco posicionamento</SelectItem>
                      </SelectContent>
                    </Select>
                    <button
                      onClick={() => removeRef(r.id)}
                      aria-label={`Remover @${r.handle}`}
                      className="min-h-11 sm:min-h-9 px-3 rounded-md text-xs text-muted-foreground hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                    >
                      Remover
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

type Perfil = {
  id: string;
  nome: string;
  tom_de_voz: string | null;
  diretrizes: unknown;
  identidade_visual: unknown;
  cta_padrao?: string | null;
  foco_curadoria?: string | null;
};

/** O recorte de `diretrizes` que faz sentido revisar depois do onboarding. */
type Diretrizes = {
  area_atuacao?: string | null;
  nicho?: string | null;
  cliente_ideal?: string | null;
  restricoes?: string[];
  bordoes?: string[];
};

function comoDiretrizes(bruto: unknown): Diretrizes {
  return bruto && typeof bruto === "object" ? (bruto as Diretrizes) : {};
}

/**
 * Antes, dois `<Textarea>` de JSON cru com validação por `JSON.parse` — o
 * advogado editava chave e colchete à mão e, no erro, recebia "JSON inválido"
 * sem linha nem pista. Agora são campos, e o que o wizard gravou e não aparece
 * aqui (objetivos, atributos, estilo narrativo, canais) é preservado no salvar.
 */
function IdentityEditor({ perfil, onSaved }: { perfil: Perfil; onSaved: () => void }) {
  const inicial = comoDiretrizes(perfil.diretrizes);

  const [tom, setTom] = useState(perfil.tom_de_voz ?? "");
  const [cta, setCta] = useState(perfil.cta_padrao ?? "");
  const [foco, setFoco] = useState(perfil.foco_curadoria ?? "posicionamento");
  const [area, setArea] = useState(inicial.area_atuacao ?? "");
  const [nicho, setNicho] = useState(inicial.nicho ?? "");
  const [clienteIdeal, setClienteIdeal] = useState(inicial.cliente_ideal ?? "");
  const [restricoes, setRestricoes] = useState((inicial.restricoes ?? []).join("\n"));
  const [bordoes, setBordoes] = useState((inicial.bordoes ?? []).join("\n"));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const d = comoDiretrizes(perfil.diretrizes);
    setTom(perfil.tom_de_voz ?? "");
    setCta(perfil.cta_padrao ?? "");
    setFoco(perfil.foco_curadoria ?? "posicionamento");
    setArea(d.area_atuacao ?? "");
    setNicho(d.nicho ?? "");
    setClienteIdeal(d.cliente_ideal ?? "");
    setRestricoes((d.restricoes ?? []).join("\n"));
    setBordoes((d.bordoes ?? []).join("\n"));
  }, [perfil.id]);

  async function save() {
    setSaving(true);
    // Espalha o que já existia: o wizard grava campos que esta tela não mostra.
    const diretrizes = {
      ...comoDiretrizes(perfil.diretrizes),
      area_atuacao: area.trim() || null,
      nicho: nicho.trim() || null,
      cliente_ideal: clienteIdeal.trim() || null,
      restricoes: linhasParaLista(restricoes),
      bordoes: linhasParaLista(bordoes),
    };

    const { error } = await supabase
      .from("perfis")
      .update({
        tom_de_voz: tom.trim() || null,
        cta_padrao: cta.trim() || null,
        foco_curadoria: foco,
        diretrizes: diretrizes as never,
      })
      .eq("id", perfil.id);
    setSaving(false);
    if (error) {
      toast.error(mensagemErro(error, "Não consegui salvar as alterações."));
      return;
    }
    toast.success("Alterações salvas.");
    onSaved();
  }

  return (
    <Card className="p-6 bg-surface border-border">
      <div className="flex items-center justify-between gap-3 mb-5">
        <h2 className="font-display font-semibold text-lg">Como a prevIA escreve como você</h2>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
      </div>
      <div className="space-y-4">
        <div>
          <Label htmlFor="campo-tom" className={ROTULO_CAMPO}>
            Tom de voz
          </Label>
          <Input
            id="campo-tom"
            value={tom}
            onChange={(e) => setTom(e.target.value)}
            placeholder="ex: direto, provocativo, empático"
          />
        </div>
        <div>
          <Label htmlFor="campo-cta" className={ROTULO_CAMPO}>
            Como você fecha seus posts
          </Label>
          <Textarea
            id="campo-cta"
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            className="min-h-20 text-sm"
            placeholder="ex: Se isso fez sentido pra você, me chama no direct."
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Vale para o fim do reel e o último slide do carrossel. A prevIA mantém a intenção e o
            canal, adaptando as palavras ao tema.
          </p>
        </div>
        <div>
          <Label htmlFor="campo-foco" className={ROTULO_CAMPO}>
            O que buscar nas referências
          </Label>
          <Select value={foco} onValueChange={setFoco}>
            <SelectTrigger id="campo-foco">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="posicionamento">
                Posicionamento — últimas postagens das referências
              </SelectItem>
              <SelectItem value="viral">
                Viral — posts com mais visualização e engajamento
              </SelectItem>
            </SelectContent>
          </Select>
          <p className="text-[11px] text-muted-foreground mt-1">
            Vale para todas as referências deste perfil, exceto as que tiverem foco próprio.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="campo-area" className={ROTULO_CAMPO}>
              Área de atuação
            </Label>
            <Input
              id="campo-area"
              value={area}
              onChange={(e) => setArea(e.target.value)}
              placeholder="ex: Direito trabalhista"
            />
          </div>
          <div>
            <Label htmlFor="campo-nicho" className={ROTULO_CAMPO}>
              Nicho <span className="normal-case tracking-normal">(opcional)</span>
            </Label>
            <Input
              id="campo-nicho"
              value={nicho}
              onChange={(e) => setNicho(e.target.value)}
              placeholder="ex: rescisões de alta renda"
            />
          </div>
        </div>

        <div>
          <Label htmlFor="campo-cliente" className={ROTULO_CAMPO}>
            Cliente ideal
          </Label>
          <Textarea
            id="campo-cliente"
            value={clienteIdeal}
            onChange={(e) => setClienteIdeal(e.target.value)}
            className="min-h-20 text-sm"
            placeholder="Quem você quer do outro lado da tela?"
          />
        </div>

        <div>
          <Label htmlFor="campo-restricoes" className={ROTULO_CAMPO}>
            Lista proibida
          </Label>
          <Textarea
            id="campo-restricoes"
            value={restricoes}
            onChange={(e) => setRestricoes(e.target.value)}
            className="min-h-24 text-sm"
            placeholder={"Uma por linha.\nex: nunca prometer resultado\nex: não usar emoji"}
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Uma por linha. Nenhum agente passa por cima desta lista.
          </p>
        </div>

        <div>
          <Label htmlFor="campo-bordoes" className={ROTULO_CAMPO}>
            Bordões <span className="normal-case tracking-normal">(opcional)</span>
          </Label>
          <Textarea
            id="campo-bordoes"
            value={bordoes}
            onChange={(e) => setBordoes(e.target.value)}
            className="min-h-20 text-sm"
            placeholder="Expressões suas que devem aparecer. Uma por linha."
          />
        </div>
      </div>
    </Card>
  );
}

