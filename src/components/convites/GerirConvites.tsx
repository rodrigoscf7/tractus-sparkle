import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Check, Copy, Link2 } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { listarConvites, salvarConvite, type ConviteComResgates } from "@/lib/convites.functions";

const DIA_MS = 86400000;

/** Data de hoje + `dias`, no formato do <input type="date">. */
function daquiA(dias: number) {
  return new Date(Date.now() + dias * DIA_MS).toISOString().slice(0, 10);
}

const linkDo = (codigo: string) =>
  `${typeof window !== "undefined" ? window.location.origin : ""}/convite/${codigo}`;

/**
 * Os links de convite (/convite/<codigo>): quem abre cria a própria conta com
 * a cortesia do convite. Aqui o admin cria o código, acompanha quem entrou e
 * desativa quando a rodada acabar.
 */
export function GerirConvites() {
  const carregar = useServerFn(listarConvites);
  const salvar = useServerFn(salvarConvite);
  const { data: convites, refetch } = useQuery({
    queryKey: ["admin-convites"],
    queryFn: () => carregar(),
  });

  const [aberto, setAberto] = useState(false);
  const [codigo, setCodigo] = useState("");
  const [descricao, setDescricao] = useState("");
  const [dias, setDias] = useState("30");
  const [usosMax, setUsosMax] = useState("");
  const [validade, setValidade] = useState(daquiA(30));
  const [salvando, setSalvando] = useState(false);

  async function criar(e: React.FormEvent) {
    e.preventDefault();
    setSalvando(true);
    try {
      await salvar({
        data: {
          codigo,
          descricao,
          diasCortesia: Number(dias) || 30,
          usosMax: usosMax ? Number(usosMax) : null,
          // Vale até o fim do dia escolhido, no horário de Brasília.
          expiraEm: validade ? new Date(`${validade}T23:59:59-03:00`).toISOString() : null,
        },
      });
      toast.success("Convite criado.");
      setCodigo("");
      setDescricao("");
      setAberto(false);
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível criar o convite.");
    } finally {
      setSalvando(false);
    }
  }

  async function alternar(c: ConviteComResgates) {
    try {
      await salvar({ data: { id: c.id, ativo: !c.ativo } });
      toast.success(c.ativo ? "Convite desativado." : "Convite reativado.");
      refetch();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Falha na operação.");
    }
  }

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-display text-lg font-semibold">Links de convite</div>
          <p className="text-sm text-muted-foreground mt-1 max-w-[62ch]">
            Quem abre o link cria a própria conta, com a senha que escolher, e já entra com a
            cortesia. O cadastro público continua fechado: só vale código ativo e dentro da
            validade.
          </p>
        </div>
        {!aberto && (
          <Button variant="outline" className="gap-2" onClick={() => setAberto(true)}>
            <Link2 className="h-4 w-4" /> Novo convite
          </Button>
        )}
      </div>

      {aberto && (
        <form onSubmit={criar} className="mt-5 grid gap-4 sm:grid-cols-2">
          <div>
            <Label htmlFor="convite-codigo">Código (vai no link)</Label>
            <Input
              id="convite-codigo"
              required
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))}
              placeholder="advogados"
              className="mt-1.5"
            />
            <p className="text-xs text-muted-foreground mt-1 break-all">{linkDo(codigo || "…")}</p>
          </div>
          <div>
            <Label htmlFor="convite-descricao">Descrição (só para você)</Label>
            <Input
              id="convite-descricao"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Vídeo de demonstração, outubro"
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="convite-dias">Dias de cortesia</Label>
            <Input
              id="convite-dias"
              type="number"
              min={1}
              max={365}
              value={dias}
              onChange={(e) => setDias(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="convite-validade">Link vale até</Label>
            <Input
              id="convite-validade"
              type="date"
              value={validade}
              onChange={(e) => setValidade(e.target.value)}
              className="mt-1.5"
            />
          </div>
          <div>
            <Label htmlFor="convite-usos">Limite de contas</Label>
            <Input
              id="convite-usos"
              type="number"
              min={1}
              value={usosMax}
              onChange={(e) => setUsosMax(e.target.value)}
              placeholder="Sem limite"
              className="mt-1.5"
            />
          </div>
          <div className="flex items-end gap-2">
            <Button type="submit" disabled={salvando}>
              {salvando ? "Criando…" : "Criar convite"}
            </Button>
            <Button type="button" variant="ghost" onClick={() => setAberto(false)}>
              Cancelar
            </Button>
          </div>
        </form>
      )}

      <div className="mt-5 space-y-3">
        {(convites ?? []).length === 0 && (
          <p className="text-sm text-muted-foreground">Nenhum convite criado ainda.</p>
        )}
        {(convites ?? []).map((c) => (
          <LinhaConvite key={c.id} convite={c} aoAlternar={() => alternar(c)} />
        ))}
      </div>
    </Card>
  );
}

function LinhaConvite({
  convite: c,
  aoAlternar,
}: {
  convite: ConviteComResgates;
  aoAlternar: () => void;
}) {
  const [copiado, setCopiado] = useState(false);
  const [verResgates, setVerResgates] = useState(false);
  const expirado = c.expira_em !== null && new Date(c.expira_em).getTime() <= Date.now();
  const esgotado = c.usos_max !== null && c.usos >= c.usos_max;
  const valendo = c.ativo && !expirado && !esgotado;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(linkDo(c.codigo));
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      toast.error("Não consegui copiar. Selecione o link e copie à mão.");
    }
  }

  return (
    <div className="rounded-md border border-border p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-sm font-medium">/convite/{c.codigo}</span>
            <Badge
              className={
                valendo
                  ? "bg-success/15 text-success border-0"
                  : "bg-muted text-muted-foreground border-0"
              }
            >
              {!c.ativo ? "Desativado" : expirado ? "Expirado" : esgotado ? "Esgotado" : "Valendo"}
            </Badge>
          </div>
          {c.descricao && <p className="text-sm text-muted-foreground mt-1">{c.descricao}</p>}
          <p className="num text-xs text-muted-foreground mt-1">
            {c.usos} {c.usos === 1 ? "conta" : "contas"}
            {c.usos_max !== null ? ` de ${c.usos_max}` : " (sem limite)"} · {c.dias_cortesia} dias
            de cortesia
            {c.expira_em
              ? ` · vale até ${new Date(c.expira_em).toLocaleDateString("pt-BR")}`
              : " · sem validade"}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" className="gap-1.5" onClick={copiar}>
            {copiado ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            {copiado ? "Copiado" : "Copiar link"}
          </Button>
          <Button size="sm" variant="ghost" onClick={aoAlternar}>
            {c.ativo ? "Desativar" : "Reativar"}
          </Button>
        </div>
      </div>

      {c.resgates.length > 0 && (
        <div className="mt-3">
          <button
            type="button"
            onClick={() => setVerResgates((v) => !v)}
            className="text-sm font-medium underline underline-offset-2 decoration-foreground/30 hover:decoration-foreground"
          >
            {verResgates ? "Esconder quem entrou" : `Ver quem entrou (${c.resgates.length})`}
          </button>
          {verResgates && (
            <ul className="mt-2 divide-y divide-divider text-sm">
              {c.resgates.map((r) => (
                <li
                  key={`${r.email}-${r.criado_em}`}
                  className="flex flex-wrap gap-x-4 gap-y-0.5 py-2"
                >
                  <span className="font-medium">{r.nome || "—"}</span>
                  <span className="text-muted-foreground">{r.email}</span>
                  {r.whatsapp && <span className="num text-muted-foreground">{r.whatsapp}</span>}
                  <span className="num text-muted-foreground ml-auto">
                    {new Date(r.criado_em).toLocaleString("pt-BR")}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
