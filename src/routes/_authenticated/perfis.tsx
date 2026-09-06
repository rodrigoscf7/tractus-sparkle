import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

function PerfisPage() {
  const [activeId, setActiveId] = useState<string | null>(null);
  const [novoHandle, setNovoHandle] = useState("");
  const [novoNome, setNovoNome] = useState("");
  const [novoTipo, setNovoTipo] = useState("cliente");
  const [criando, setCriando] = useState(false);
  const { data: conta } = useConta();


  const { data: perfis, refetch: refetchPerfis } = useQuery({
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

  async function addReferencia() {
    if (!activeId || !novoHandle.trim()) return;
    const handle = novoHandle.replace(/^@/, "").trim();
    const { error } = await supabase.from("perfis_referencia").insert({
      handle,
      perfil_id_relacionado: activeId,
      conta_id: perfis?.find((p) => p.id === activeId)?.conta_id ?? null,
    });
    if (error) {
      toast.error(error.message);
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
      toast.error(error.message);
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
        <h1 className="text-2xl sm:text-3xl font-display font-bold">Perfis</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Volume e status de conteúdo por perfil. Selecione um para gerenciar referências.
        </p>
      </header>

      <Card className="p-5 bg-surface border-border mb-8">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
          Criar novo perfil
        </h2>
        <div className="flex flex-col sm:flex-row gap-2">
          <Input
            value={novoNome}
            onChange={(e) => setNovoNome(e.target.value)}
            placeholder="Nome do perfil (ex: Márcia Canuto)"
            onKeyDown={(e) => e.key === "Enter" && criarPerfil()}
          />
          <Select value={novoTipo} onValueChange={setNovoTipo}>
            <SelectTrigger className="sm:w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cliente">Cliente</SelectItem>
              <SelectItem value="socio">Sócio</SelectItem>
              <SelectItem value="institucional">Institucional</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={criarPerfil} disabled={criando}>
            {criando ? "Criando..." : "Criar perfil"}
          </Button>
        </div>
      </Card>

      {perfis?.length === 0 && (
        <p className="text-sm text-muted-foreground italic mb-8">
          Você ainda não tem perfis. Crie o primeiro acima para começar a configurar tom de voz,
          CTA e perfis de referência.
        </p>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">

        {perfis?.map((perfil) => {
          const ps = (pautas ?? []).filter((x) => x.perfil_id === perfil.id);
          const isActive = perfil.id === activeId;
          return (
            <Card
              key={perfil.id}
              onClick={() => setActiveId(isActive ? null : perfil.id)}
              className={`p-5 bg-surface border-border cursor-pointer transition hover:border-primary/40 ${
                isActive ? "border-primary" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h3 className="font-display font-semibold truncate">{perfil.nome}</h3>
                  <Badge variant="outline" className="mt-1 text-[10px] uppercase font-mono">
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
                    <div key={s} className="flex justify-between text-xs">
                      <span className="text-muted-foreground capitalize">{s.replace("_", " ")}</span>
                      <span className="font-mono">{n}</span>
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
            <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground mb-4">
              Perfis de referência (Instagram)
            </h2>
            <div className="flex gap-2 mb-4">
              <Input
                value={novoHandle}
                onChange={(e) => setNovoHandle(e.target.value)}
                placeholder="@handle.instagram"
                onKeyDown={(e) => e.key === "Enter" && addReferencia()}
              />
              <Button onClick={addReferencia}>Adicionar</Button>
            </div>
            <div className="space-y-2">
              {refs?.length === 0 && (
                <p className="text-sm text-muted-foreground italic">
                  Nenhum perfil de referência ainda. O curador precisa deles para rodar.
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
                        if (error) toast.error(error.message);
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
                      className="text-xs text-muted-foreground hover:text-destructive"
                    >
                      remover
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

function IdentityEditor({ perfil, onSaved }: { perfil: Perfil; onSaved: () => void }) {
  const [tom, setTom] = useState(perfil.tom_de_voz ?? "");
  const [cta, setCta] = useState(perfil.cta_padrao ?? "");
  const [foco, setFoco] = useState(perfil.foco_curadoria ?? "posicionamento");
  const [diretrizes, setDiretrizes] = useState(
    JSON.stringify(perfil.diretrizes ?? {}, null, 2),
  );
  const [identidade, setIdentidade] = useState(
    JSON.stringify(perfil.identidade_visual ?? {}, null, 2),
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTom(perfil.tom_de_voz ?? "");
    setCta(perfil.cta_padrao ?? "");
    setFoco(perfil.foco_curadoria ?? "posicionamento");
    setDiretrizes(JSON.stringify(perfil.diretrizes ?? {}, null, 2));
    setIdentidade(JSON.stringify(perfil.identidade_visual ?? {}, null, 2));
  }, [perfil.id]);

  async function save() {
    let dirJson: unknown;
    let idJson: unknown;
    try {
      dirJson = JSON.parse(diretrizes || "{}");
    } catch {
      toast.error("Diretrizes: JSON inválido.");
      return;
    }
    try {
      idJson = JSON.parse(identidade || "{}");
    } catch {
      toast.error("Identidade visual: JSON inválido.");
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from("perfis")
      .update({
        tom_de_voz: tom.trim() || null,
        cta_padrao: cta.trim() || null,
        foco_curadoria: foco,
        diretrizes: dirJson as never,
        identidade_visual: idJson as never,
      })
      .eq("id", perfil.id);
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Perfil atualizado.");
    onSaved();
  }

  return (
    <Card className="p-6 bg-surface border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Identidade · {perfil.nome}
        </h2>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
      <div className="space-y-4">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Tom de voz
          </div>
          <Input value={tom} onChange={(e) => setTom(e.target.value)} placeholder="ex: direto, provocativo, empático" />
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            CTA padrão (fim do reel e último slide do carrossel)
          </div>
          <Textarea
            value={cta}
            onChange={(e) => setCta(e.target.value)}
            className="min-h-20 text-sm"
            placeholder="ex: Se isso fez sentido pra você, me chama no direct."
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            Os agentes mantêm a intenção e o canal desta CTA, adaptando as palavras ao tema.
          </p>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Foco da curadoria
          </div>
          <Select value={foco} onValueChange={setFoco}>
            <SelectTrigger>
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
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Diretrizes (JSON)
          </div>
          <Textarea
            value={diretrizes}
            onChange={(e) => setDiretrizes(e.target.value)}
            className="font-mono text-xs min-h-64"
            spellCheck={false}
          />
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
            Identidade visual (JSON)
          </div>
          <Textarea
            value={identidade}
            onChange={(e) => setIdentidade(e.target.value)}
            className="font-mono text-xs min-h-64"
            spellCheck={false}
          />
        </div>
      </div>
    </Card>
  );
}

