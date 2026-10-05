import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { mensagemErro } from "@/lib/mensagem-erro";
import { CarrosselSlide } from "@/components/CarrosselSlide";
import { FONTES_CARROSSEL } from "@/lib/carrossel-fontes";
import { useFontesCarrossel } from "@/hooks/use-fontes-carrossel";
import {
  FOTO_BUCKET,
  MODELOS_CARROSSEL,
  fotoAsDataUrl,
  modeloDoId,
  parseTemplate,
  type CarrosselSlideData,
  type TemplateCarrossel,
} from "@/lib/carrossel-template";
import { cn } from "@/lib/utils";

/** Prévia com o que um carrossel de verdade tem: uma capa e um slide de conteúdo. */
const SLIDES_EXEMPLO: CarrosselSlideData[] = [
  {
    tipo: "capa",
    titulo: "3 erros que fazem o INSS negar o seu benefício",
    corpo: "O segundo quase ninguém percebe.",
    destaque: "quase ninguém percebe",
  },
  {
    tipo: "conteudo",
    titulo: "1. Laudo sem a sua rotina",
    corpo:
      "O perito avalia o que está escrito. Se o laudo não mostra o que você deixou de conseguir fazer, a limitação não existe para ele.",
    destaque: "a limitação não existe",
  },
];

const ROTULO = "text-[11px] font-mono uppercase tracking-widest text-muted-foreground";

function CampoCor({
  rotulo,
  valor,
  onChange,
}: {
  rotulo: string;
  valor: string;
  onChange: (cor: string) => void;
}) {
  return (
    <div>
      <Label className={ROTULO}>{rotulo}</Label>
      <div className="flex gap-2 mt-1">
        <input
          type="color"
          value={valor}
          onChange={(e) => onChange(e.target.value)}
          className="h-9 w-12 rounded border border-border bg-background"
        />
        <Input value={valor} onChange={(e) => onChange(e.target.value)} />
      </div>
    </div>
  );
}

/** Uma miniatura da capa por modelo, já com as cores, fontes e identidade do perfil. */
function SeletorDeModelo({
  template,
  fotoDataUrl,
  onChange,
}: {
  template: TemplateCarrossel;
  fotoDataUrl: string;
  onChange: (modelo: TemplateCarrossel["modelo"]) => void;
}) {
  return (
    <div className="mb-5">
      <div className={cn(ROTULO, "mb-2")}>Modelo</div>
      <div className="grid grid-cols-3 gap-3">
        {MODELOS_CARROSSEL.map((m) => {
          const ativo = m.id === template.modelo;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => onChange(m.id)}
              aria-pressed={ativo}
              className={cn(
                "rounded-lg border p-2 text-left transition-colors",
                ativo ? "border-primary ring-1 ring-primary" : "border-border hover:border-foreground/40",
              )}
            >
              <div className="flex justify-center pointer-events-none">
                <CarrosselSlide
                  slide={SLIDES_EXEMPLO[0]}
                  template={{ ...template, modelo: m.id }}
                  fotoDataUrl={fotoDataUrl}
                  index={0}
                  total={8}
                  scale={0.11}
                />
              </div>
              <div className="mt-2 text-sm font-medium">{m.nome}</div>
              <div className="text-xs text-muted-foreground leading-snug">{m.descricao}</div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function SeletorDeFonte({
  id,
  rotulo,
  valor,
  onChange,
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (id: string) => void;
}) {
  return (
    <div>
      <Label htmlFor={id} className={ROTULO}>
        {rotulo}
      </Label>
      <Select value={valor} onValueChange={onChange}>
        <SelectTrigger id={id} className="mt-1">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {FONTES_CARROSSEL.map((f) => (
            <SelectItem key={f.id} value={f.id}>
              {f.nome} <span className="text-muted-foreground">· {f.tom}</span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function TemplateCarrosselEditor({
  perfilId,
  perfilNome,
  templateRaw,
  onSaved,
}: {
  perfilId: string;
  perfilNome: string;
  templateRaw: unknown;
  onSaved: () => void;
}) {
  const [t, setT] = useState<TemplateCarrossel>(() => parseTemplate(templateRaw));
  const [fotoDataUrl, setFotoDataUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const { pronto: fontesProntas } = useFontesCarrossel(t.fonte_titulo, t.fonte_texto);
  const usa = modeloDoId(t.modelo).usa;

  useEffect(() => {
    const next = parseTemplate(templateRaw);
    setT(next);
    fotoAsDataUrl(next.foto_path).then(setFotoDataUrl);
  }, [perfilId]);

  function set<K extends keyof TemplateCarrossel>(key: K, value: TemplateCarrossel[K]) {
    setT((prev) => ({ ...prev, [key]: value }));
  }

  async function uploadFoto(file: File) {
    setUploading(true);
    const ext = file.name.split(".").pop()?.toLowerCase() || "png";
    const path = `${perfilId}/foto-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from(FOTO_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });
    setUploading(false);
    if (error) {
      toast.error(mensagemErro(error, "Não consegui enviar a foto."));
      return;
    }
    set("foto_path", path);
    setFotoDataUrl(await fotoAsDataUrl(path));
    toast.success("Foto carregada. Salve para aplicar.");
  }

  async function save() {
    setSaving(true);
    const { error } = await supabase
      .from("perfis")
      .update({ template_carrossel: { ...t, arroba: t.arroba.replace(/^@/, "") } as never })
      .eq("id", perfilId);
    setSaving(false);
    if (error) {
      toast.error(mensagemErro(error, "Não consegui salvar o template."));
      return;
    }
    toast.success("Template do carrossel salvo.");
    onSaved();
  }

  return (
    <Card className="p-6 bg-surface border-border">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Template do carrossel · {perfilNome}
        </h2>
        <Button size="sm" onClick={save} disabled={saving}>
          {saving ? "Salvando..." : "Salvar"}
        </Button>
      </div>

      <SeletorDeModelo
        template={t}
        fotoDataUrl={fotoDataUrl}
        onChange={(modelo) => set("modelo", modelo)}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {usa.nome && (
          <div>
            <Label className={ROTULO}>Nome de exibição</Label>
            <Input
              className="mt-1"
              value={t.nome_exibicao}
              onChange={(e) => set("nome_exibicao", e.target.value)}
              placeholder="Márcia Canuto"
            />
          </div>
        )}
        <div>
          <Label className={ROTULO}>Arroba</Label>
          <Input
            className="mt-1"
            value={t.arroba}
            onChange={(e) => set("arroba", e.target.value.replace(/^@/, ""))}
            placeholder="marciacanuto.adv"
          />
        </div>
        <CampoCor rotulo="Cor de fundo" valor={t.cor_fundo} onChange={(v) => set("cor_fundo", v)} />
        <CampoCor rotulo="Cor do texto" valor={t.cor_texto} onChange={(v) => set("cor_texto", v)} />
        {usa.cor_destaque && (
          <CampoCor
            rotulo="Cor de destaque"
            valor={t.cor_destaque}
            onChange={(v) => set("cor_destaque", v)}
          />
        )}
        {usa.foto && (
          <div>
            <Label className={ROTULO}>Foto de perfil</Label>
            <Input
              className="mt-1"
              type="file"
              accept="image/*"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) uploadFoto(f);
              }}
            />
          </div>
        )}
        {usa.verificado && (
          <div className="flex items-center gap-3 pt-6">
            <Switch checked={t.verificado} onCheckedChange={(v) => set("verificado", v)} />
            <span className="text-sm">Selo de verificado</span>
          </div>
        )}
        <SeletorDeFonte
          id="fonte-titulo"
          rotulo="Fonte dos títulos"
          valor={t.fonte_titulo}
          onChange={(v) => set("fonte_titulo", v)}
        />
        <SeletorDeFonte
          id="fonte-texto"
          rotulo="Fonte do texto"
          valor={t.fonte_texto}
          onChange={(v) => set("fonte_texto", v)}
        />
      </div>

      <div className="mt-6">
        <div className={cn(ROTULO, "mb-2")}>
          Prévia {fontesProntas ? "" : "· carregando fontes…"}
        </div>
        <div className="flex flex-wrap gap-3">
          {SLIDES_EXEMPLO.map((slide, i) => (
            <CarrosselSlide
              key={i}
              slide={slide}
              template={t}
              fotoDataUrl={fotoDataUrl}
              index={i}
              total={8}
              scale={0.22}
            />
          ))}
        </div>
      </div>
    </Card>
  );
}
