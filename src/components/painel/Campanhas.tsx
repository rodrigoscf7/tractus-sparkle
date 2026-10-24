import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Fragment, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Copy,
  Info,
  MessageCircle,
  RefreshCw,
  ThumbsUp,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Kpi, Metrica } from "@/components/painel/metricas";
import { EstadoCarregando, EstadoErro } from "@/components/estados";
import {
  getPainelCampanhas,
  removerInvestimento,
  salvarInvestimento,
  type LinhaFunil,
  type PainelCampanhas,
} from "@/lib/campanhas.functions";
import { cn } from "@/lib/utils";

/**
 * Aba Campanhas do admin: funil do anúncio à compra, por campanha e criativo,
 * com o que dá para fazer a partir dele (marcar os anúncios, lançar o
 * investimento, recuperar quem parou no checkout).
 */

const PERIODOS = [7, 14, 30, 90] as const;

/** Parâmetros de URL do Meta: cada anúncio leva o nome da campanha, conjunto e anúncio. */
const PARAMETROS_URL =
  "utm_source=meta&utm_medium=paid&utm_campaign={{campaign.name}}&utm_term={{adset.name}}&utm_content={{ad.name}}&utm_id={{campaign.id}}&ad_id={{ad.id}}";

const ROTULO = "text-xs font-mono uppercase tracking-widest text-muted-foreground";

const brl = (centavos: number) =>
  (centavos / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const pct = (parte: number, todo: number) =>
  todo > 0 ? `${Math.round((parte / todo) * 100)}%` : "—";
const razao = (a: number, b: number) => (b > 0 ? (a / b).toFixed(2).replace(".", ",") : "—");
const ctr = (cliques: number, impressoes: number) =>
  impressoes > 0 ? `${((cliques / impressoes) * 100).toFixed(2).replace(".", ",")}%` : "—";
const porUnidade = (centavos: number, n: number) =>
  n > 0 && centavos > 0 ? brl(Math.round(centavos / n)) : "—";

function hojeLocal() {
  return new Date().toLocaleDateString("sv-SE", { timeZone: "America/Sao_Paulo" });
}

export function Campanhas() {
  const [dias, setDias] = useState<number>(30);
  const [relendo, setRelendo] = useState(false);
  const carregar = useServerFn(getPainelCampanhas);
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["admin-campanhas", dias],
    queryFn: () => carregar({ data: { dias } }),
  });

  /** Relê a conta de anúncios agora, sem esperar a hora de intervalo. */
  async function atualizarMeta() {
    setRelendo(true);
    try {
      const novo = await carregar({ data: { dias, atualizar: true } });
      queryClient.setQueryData(["admin-campanhas", dias], novo);
      if (novo.metaAds.erro) toast.error("O Meta recusou a leitura. Veja o aviso no topo.");
      else toast.success("Gasto do Meta atualizado.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao atualizar.");
    } finally {
      setRelendo(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground max-w-2xl">
          Leads que começaram o quiz no período e o que fizeram depois. Receita é a venda aprovada
          na Hubla (sem renovação e sem juros do parcelamento).
        </p>
        <div className="flex gap-1 rounded-md border border-border p-1">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setDias(p)}
              className={cn(
                "rounded px-3 py-1 text-sm transition",
                dias === p
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {p} dias
            </button>
          ))}
        </div>
      </div>

      {isLoading && <EstadoCarregando linhas={4} rotulo="Carregando as campanhas" />}
      {isError && (
        <EstadoErro titulo="Não consegui carregar as campanhas" onTentarDeNovo={() => refetch()} />
      )}
      {data && (
        <Painel
          data={data}
          recarregar={() => refetch()}
          atualizarMeta={atualizarMeta}
          relendo={relendo}
        />
      )}
    </div>
  );
}

function Painel({
  data,
  recarregar,
  atualizarMeta,
  relendo,
}: {
  data: PainelCampanhas;
  recarregar: () => void;
  atualizarMeta: () => void;
  relendo: boolean;
}) {
  const t = data.total;
  return (
    <>
      {data.alertas.length > 0 && (
        <div className="space-y-2">
          {data.alertas.map((a, i) => (
            <div
              key={i}
              className={cn(
                "flex items-start gap-3 rounded-md border px-4 py-3 text-sm",
                a.nivel === "atencao" && "border-warning/40 bg-warning/5",
                a.nivel === "bom" && "border-success/40 bg-success/5",
                a.nivel === "info" && "border-border bg-surface",
              )}
            >
              {a.nivel === "atencao" && (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
              )}
              {a.nivel === "bom" && <ThumbsUp className="mt-0.5 h-4 w-4 shrink-0 text-success" />}
              {a.nivel === "info" && (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
              )}
              <span>{a.texto}</span>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 lg:grid-cols-5">
        <Kpi
          label="Cliques no anúncio"
          valor={t.cliquesLink ? t.cliquesLink.toLocaleString("pt-BR") : "—"}
          detalhe={t.impressoes ? `CTR ${ctr(t.cliquesLink, t.impressoes)}` : "sem dados do Meta"}
        />
        <Kpi
          label="Começaram o quiz"
          valor={String(t.leads)}
          detalhe={t.cliquesLink ? `${pct(t.leads, t.cliquesLink)} dos cliques` : undefined}
        />
        <Kpi
          label="Diagnósticos"
          valor={String(t.diagnosticos)}
          detalhe={`${pct(t.diagnosticos, t.leads)} dos leads`}
        />
        <Kpi
          label="Clicaram em comprar"
          valor={String(t.checkouts)}
          detalhe={`${pct(t.checkouts, t.diagnosticos)} dos diagnósticos`}
        />
        <Kpi
          label="Compraram"
          valor={String(t.compras)}
          detalhe={`${pct(t.compras, t.diagnosticos)} dos diagnósticos`}
        />
        <Kpi
          label="Receita"
          valor={brl(t.receitaCentavos)}
          detalhe={`ticket ${porUnidade(t.receitaCentavos, t.compras)}`}
        />
        <Kpi
          label="Investimento"
          valor={t.investimentoCentavos ? brl(t.investimentoCentavos) : "—"}
          detalhe={data.metaAds.configurado ? "Meta + lançado à mão" : "lançado à mão"}
        />
        <Kpi
          label="Custo por diagnóstico"
          valor={porUnidade(t.investimentoCentavos, t.diagnosticos)}
        />
        <Kpi label="Custo por compra" valor={porUnidade(t.investimentoCentavos, t.compras)} />
        <Kpi
          label="ROAS"
          valor={t.investimentoCentavos ? razao(t.receitaCentavos, t.investimentoCentavos) : "—"}
          alerta={t.investimentoCentavos > 0 && t.receitaCentavos < t.investimentoCentavos}
          detalhe="receita ÷ investimento"
        />
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        <GraficoDia titulo="Investimento por dia" dados={data.porDia} chave="investimento" />
        <GraficoDia titulo="Diagnósticos por dia" dados={data.porDia} chave="diagnosticos" />
        <GraficoDia titulo="Compras por dia" dados={data.porDia} chave="compras" />
      </div>

      <TabelaCampanhas campanhas={data.campanhas} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Oferta oferta={data.oferta} />
        <Rastreio
          r={data.rastreio}
          metaAds={data.metaAds}
          atualizarMeta={atualizarMeta}
          relendo={relendo}
        />
      </div>

      <Card className="p-5">
        <div className={ROTULO}>Parâmetros de URL dos anúncios</div>
        <p className="mt-2 text-sm text-muted-foreground">
          Sem isto o painel não separa campanha nem criativo. No Gerenciador de Anúncios, em cada
          anúncio: Rastreamento → Parâmetros de URL → cole o texto abaixo. O Meta troca o que está
          entre chaves pelo nome e pelo ID da campanha, do conjunto e do anúncio. Os nomes ficam
          travados no da publicação; os IDs (utm_id e ad_id) mantêm o lead ligado ao gasto mesmo se
          alguém renomear depois.
        </p>
        <div className="mt-3 flex items-start gap-2">
          <code className="min-w-0 flex-1 break-all rounded-md border border-border bg-surface px-3 py-2 text-xs">
            {PARAMETROS_URL}
          </code>
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              navigator.clipboard
                .writeText(PARAMETROS_URL)
                .then(() => toast.success("Parâmetros copiados."))
                .catch(() => toast.error("Não consegui copiar."))
            }
          >
            <Copy className="mr-1.5 h-4 w-4" /> Copiar
          </Button>
        </div>
      </Card>

      <Investimentos data={data} recarregar={recarregar} />
      <Recuperacao itens={data.recuperar} />
    </>
  );
}

function GraficoDia({
  titulo,
  dados,
  chave,
}: {
  titulo: string;
  dados: PainelCampanhas["porDia"];
  chave: "diagnosticos" | "compras" | "investimento";
}) {
  const total = dados.reduce((s, d) => s + d[chave], 0);
  const dinheiro = chave === "investimento";
  const formatar = (v: number) =>
    dinheiro ? v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : String(v);
  const rotuloDia = (dia: string) => `${dia.slice(8, 10)}/${dia.slice(5, 7)}`;
  return (
    <Card className="p-5">
      <div className="flex items-baseline justify-between gap-3">
        <div className={ROTULO}>{titulo}</div>
        <div className="num text-sm text-muted-foreground">{formatar(total)} no período</div>
      </div>
      <div className="mt-4 h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={dados}
            margin={{ top: 4, right: 0, bottom: 0, left: -24 }}
            barCategoryGap={2}
          >
            <CartesianGrid vertical={false} stroke="var(--border)" />
            <XAxis
              dataKey="dia"
              tickFormatter={rotuloDia}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={{ stroke: "var(--border)" }}
              minTickGap={24}
            />
            <YAxis
              allowDecimals={dinheiro}
              tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
              tickLine={false}
              axisLine={false}
              width={40}
            />
            <Tooltip
              cursor={{ fill: "var(--border)", opacity: 0.4 }}
              content={({ active, payload, label }) =>
                active && payload?.length ? (
                  <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-sm">
                    <div className="text-muted-foreground">{rotuloDia(String(label))}</div>
                    <div className="num mt-0.5 font-medium">
                      {formatar(Number(payload[0]?.value ?? 0))}
                      {chave === "compras"
                        ? " compra(s)"
                        : chave === "diagnosticos"
                          ? " diagnóstico(s)"
                          : ""}
                    </div>
                  </div>
                ) : null
              }
            />
            <Bar dataKey={chave} fill="var(--foreground)" radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Card>
  );
}

function Celulas({ l }: { l: LinhaFunil }) {
  return (
    <>
      <td className="num px-3 py-2 text-right">
        {l.impressoes ? l.impressoes.toLocaleString("pt-BR") : "—"}
      </td>
      <td className="num px-3 py-2 text-right">
        {l.cliquesLink ? l.cliquesLink.toLocaleString("pt-BR") : "—"}
      </td>
      <td className="num px-3 py-2 text-right">{ctr(l.cliquesLink, l.impressoes)}</td>
      <td className="num px-3 py-2 text-right">{l.leads}</td>
      <td className="num px-3 py-2 text-right">{l.diagnosticos}</td>
      <td className="num px-3 py-2 text-right">{l.checkouts}</td>
      <td className="num px-3 py-2 text-right">{l.compras}</td>
      <td className="num px-3 py-2 text-right">{pct(l.compras, l.diagnosticos)}</td>
      <td className="num px-3 py-2 text-right">
        {l.receitaCentavos ? brl(l.receitaCentavos) : "—"}
      </td>
      <td className="num px-3 py-2 text-right">
        {l.investimentoCentavos ? brl(l.investimentoCentavos) : "—"}
      </td>
      <td className="num px-3 py-2 text-right">
        {porUnidade(l.investimentoCentavos, l.diagnosticos)}
      </td>
      <td className="num px-3 py-2 text-right">{porUnidade(l.investimentoCentavos, l.compras)}</td>
      <td
        className={cn(
          "num px-3 py-2 text-right",
          l.investimentoCentavos > 0 &&
            l.receitaCentavos < l.investimentoCentavos &&
            "text-destructive",
        )}
      >
        {l.investimentoCentavos ? razao(l.receitaCentavos, l.investimentoCentavos) : "—"}
      </td>
    </>
  );
}

function TabelaCampanhas({ campanhas }: { campanhas: PainelCampanhas["campanhas"] }) {
  const [aberta, setAberta] = useState<string | null>(null);
  return (
    <Card className="p-0 overflow-hidden">
      <div className="px-5 pt-5">
        <div className={ROTULO}>Campanhas e criativos</div>
        <p className="mt-1 text-sm text-muted-foreground">
          Clique numa campanha para ver os anúncios. Impressões, cliques no link e gasto vêm do
          Meta; o resto, do funil. A ligação é pelo nome da campanha e do anúncio.
        </p>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[1240px] text-sm">
          <thead>
            <tr className="border-y border-border text-left text-xs text-muted-foreground">
              <th className="px-5 py-2 font-medium">Campanha</th>
              <th className="px-3 py-2 text-right font-medium">Impressões</th>
              <th className="px-3 py-2 text-right font-medium">Cliques</th>
              <th className="px-3 py-2 text-right font-medium">CTR</th>
              <th className="px-3 py-2 text-right font-medium">Leads</th>
              <th className="px-3 py-2 text-right font-medium">Diagnósticos</th>
              <th className="px-3 py-2 text-right font-medium">Clic. comprar</th>
              <th className="px-3 py-2 text-right font-medium">Compras</th>
              <th className="px-3 py-2 text-right font-medium">Conversão</th>
              <th className="px-3 py-2 text-right font-medium">Receita</th>
              <th className="px-3 py-2 text-right font-medium">Investimento</th>
              <th className="px-3 py-2 text-right font-medium">Custo/diag.</th>
              <th className="px-3 py-2 text-right font-medium">Custo/compra</th>
              <th className="px-3 py-2 text-right font-medium">ROAS</th>
            </tr>
          </thead>
          <tbody>
            {campanhas.length === 0 && (
              <tr>
                <td colSpan={14} className="px-5 py-6 text-center text-muted-foreground">
                  Nenhum lead no período.
                </td>
              </tr>
            )}
            {campanhas.map((c) => (
              <Fragment key={c.nome}>
                <tr
                  className="cursor-pointer border-b border-border hover:bg-surface"
                  onClick={() => setAberta(aberta === c.nome ? null : c.nome)}
                >
                  <td className="px-5 py-2">
                    <span className="inline-flex items-center gap-1.5 font-medium">
                      {aberta === c.nome ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                      {c.nome}
                    </span>
                  </td>
                  <Celulas l={c} />
                </tr>
                {aberta === c.nome &&
                  c.criativos.map((cr) => (
                    <tr
                      key={cr.nome}
                      className="border-b border-border bg-surface/50 text-muted-foreground"
                    >
                      <td className="py-2 pl-12 pr-3">{cr.nome}</td>
                      <Celulas l={cr} />
                    </tr>
                  ))}
              </Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}

function Oferta({ oferta }: { oferta: PainelCampanhas["oferta"] }) {
  return (
    <Card className="p-5">
      <div className={ROTULO}>Oferta</div>
      <p className="mt-1 text-sm text-muted-foreground">
        {oferta.vendas} venda(s) do plano · {brl(oferta.receitaCentavos)} com upsell e order bumps
      </p>
      <div className="mt-4 space-y-4">
        <Metrica label="Upsell anual aceito" usado={oferta.anual} limite={oferta.compradores} />
        {oferta.materiais.map((m) => (
          <Metrica
            key={m.codigo}
            label={`Order bump · ${m.nome}`}
            usado={m.contas}
            limite={oferta.compradores}
          />
        ))}
        <div className="flex items-baseline justify-between text-sm">
          <span className="text-muted-foreground">Reembolsos e chargebacks</span>
          <span className="num">{oferta.reembolsos}</span>
        </div>
      </div>
    </Card>
  );
}

function Rastreio({
  r,
  metaAds,
  atualizarMeta,
  relendo,
}: {
  r: PainelCampanhas["rastreio"];
  metaAds: PainelCampanhas["metaAds"];
  atualizarMeta: () => void;
  relendo: boolean;
}) {
  const hora = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  const status = (ok: boolean, rotulo: string) => (
    <Badge variant={ok ? "secondary" : "destructive"}>{rotulo}</Badge>
  );
  return (
    <Card className="p-5">
      <div className={ROTULO}>Saúde do rastreamento</div>
      <div className="mt-3 flex flex-wrap gap-2">
        {status(r.pixel, r.pixel ? "Pixel configurado" : "Pixel ausente")}
        {status(r.capi, r.capi ? "API de Conversões ligada" : "API de Conversões desligada")}
        {r.modoTeste && <Badge variant="destructive">Modo de teste</Badge>}
        {status(
          metaAds.configurado && !metaAds.erro,
          !metaAds.configurado
            ? "Conta de anúncios não conectada"
            : metaAds.erro
              ? "Conta de anúncios com erro"
              : "Conta de anúncios conectada",
        )}
      </div>
      {metaAds.configurado && (
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span>
            Gasto do Meta{" "}
            {metaAds.ultimaEm ? `lido em ${hora(metaAds.ultimaEm)}` : "ainda não lido"} · relê
            sozinho a cada hora
          </span>
          <Button variant="outline" size="sm" onClick={atualizarMeta} disabled={relendo}>
            <RefreshCw className={cn("mr-1.5 h-3.5 w-3.5", relendo && "animate-spin")} /> Atualizar
            agora
          </Button>
        </div>
      )}
      <div className="mt-4 space-y-4">
        <Metrica label="Leads com campanha (UTM)" usado={r.comCampanha} limite={r.leads} />
        <Metrica label="Leads vindos de clique em anúncio" usado={r.comClique} limite={r.leads} />
        <Metrica label="Leads com Pixel no navegador" usado={r.comPixel} limite={r.leads} />
        <Metrica
          label="Lead enviado pelo servidor"
          usado={r.leadsEnviados}
          limite={r.diagnosticosComEmail}
        />
        <Metrica
          label="Vendas ligadas a uma campanha"
          usado={r.vendasComOrigem}
          limite={r.vendas}
        />
      </div>
    </Card>
  );
}

function Investimentos({ data, recarregar }: { data: PainelCampanhas; recarregar: () => void }) {
  const salvar = useServerFn(salvarInvestimento);
  const remover = useServerFn(removerInvestimento);
  const [dia, setDia] = useState(hojeLocal());
  const [campanha, setCampanha] = useState("");
  const [valor, setValor] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function lancar() {
    const centavos = Math.round(Number(valor.replace(/\./g, "").replace(",", ".")) * 100);
    if (!campanha.trim() || !Number.isFinite(centavos) || centavos < 0) {
      toast.error("Preencha a campanha e o valor.");
      return;
    }
    setEnviando(true);
    try {
      await salvar({ data: { dia, campanha: campanha.trim(), valorCentavos: centavos } });
      toast.success("Investimento lançado.");
      setValor("");
      recarregar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Falha ao lançar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Card className="p-5">
      <div className={ROTULO}>Investimento</div>
      <p className="mt-1 text-sm text-muted-foreground">
        {data.metaAds.configurado
          ? "O gasto do Meta entra sozinho. Lance aqui só o que não passa pela conta de anúncios (outro canal, influenciador), por dia e campanha; o mesmo dia e campanha substitui o valor."
          : "Lance o gasto de cada campanha por dia (o mesmo dia e campanha substitui o valor). O nome precisa ser igual ao da campanha no Meta, que é o que chega na UTM."}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[150px_1fr_140px_auto] sm:items-end">
        <div>
          <Label htmlFor="inv-dia">Dia</Label>
          <Input id="inv-dia" type="date" value={dia} onChange={(e) => setDia(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="inv-campanha">Campanha</Label>
          <Input
            id="inv-campanha"
            list="campanhas-conhecidas"
            value={campanha}
            onChange={(e) => setCampanha(e.target.value)}
            placeholder="Nome da campanha no Meta"
          />
          <datalist id="campanhas-conhecidas">
            {data.campanhasConhecidas.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </div>
        <div>
          <Label htmlFor="inv-valor">Valor (R$)</Label>
          <Input
            id="inv-valor"
            inputMode="decimal"
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="150,00"
          />
        </div>
        <Button onClick={lancar} disabled={enviando}>
          Lançar
        </Button>
      </div>

      {data.investimentos.length > 0 && (
        <ul className="mt-5 divide-y divide-border rounded-md border border-border text-sm">
          {data.investimentos.slice(0, 30).map((i) => (
            <li key={i.id} className="flex items-center gap-3 px-3 py-2">
              <span className="num w-24 text-muted-foreground">
                {i.dia.slice(8, 10)}/{i.dia.slice(5, 7)}/{i.dia.slice(0, 4)}
              </span>
              <span className="min-w-0 flex-1 truncate">{i.campanha}</span>
              <span className="num">{brl(i.valorCentavos)}</span>
              <button
                type="button"
                aria-label="Remover lançamento"
                className="text-muted-foreground hover:text-destructive"
                onClick={async () => {
                  try {
                    await remover({ data: { id: i.id } });
                    recarregar();
                  } catch (e) {
                    toast.error(e instanceof Error ? e.message : "Falha ao remover.");
                  }
                }}
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}

function linkWhatsapp(numero: string, nome: string | null) {
  const digitos = numero.replace(/\D/g, "");
  const comPais = digitos.length <= 11 ? `55${digitos}` : digitos;
  const primeiro = nome?.trim().split(/\s+/)[0];
  const texto = `Oi${primeiro ? `, ${primeiro}` : ""}! Aqui é da prevIA. Vi que você fez o diagnóstico do seu perfil. Ficou alguma dúvida sobre o resultado ou sobre como funciona o acesso?`;
  return `https://wa.me/${comPais}?text=${encodeURIComponent(texto)}`;
}

function Recuperacao({ itens }: { itens: PainelCampanhas["recuperar"] }) {
  const data = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  return (
    <Card className="p-5">
      <div className={ROTULO}>Recuperação</div>
      <p className="mt-1 text-sm text-muted-foreground">
        Receberam o diagnóstico nos últimos 14 dias e não compraram. Quem clicou em comprar vem
        primeiro: é quem está mais perto de fechar.
      </p>
      {itens.length === 0 ? (
        <p className="mt-4 text-sm text-muted-foreground">Ninguém para recuperar agora.</p>
      ) : (
        <ul className="mt-4 divide-y divide-border rounded-md border border-border">
          {itens.map((l) => (
            <li
              key={l.id}
              className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3 text-sm"
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{l.nome ?? l.email ?? "Sem nome"}</span>
                  {l.checkoutEm && <Badge>Clicou em comprar · {data(l.checkoutEm)}</Badge>}
                </div>
                <div className="mt-0.5 truncate text-xs text-muted-foreground">
                  Diagnóstico {data(l.diagnosticoEm)} · {l.campanha}
                  {l.email ? ` · ${l.email}` : ""}
                </div>
              </div>
              <div className="flex gap-2">
                <Button asChild variant="outline" size="sm">
                  <a
                    href={`/dna-viral/${l.token}?ver=completo`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Relatório
                  </a>
                </Button>
                {l.whatsapp && (
                  <Button asChild variant="outline" size="sm">
                    <a
                      href={linkWhatsapp(l.whatsapp, l.nome)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageCircle className="mr-1.5 h-4 w-4" /> WhatsApp
                    </a>
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
