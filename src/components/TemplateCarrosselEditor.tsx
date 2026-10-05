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
  fotoAsDataUrl,
  parseTemplate,
  type CarrosselSlideData,
  type TemplateCarrossel,
} from "@/lib/carrossel-template";

/** Prévia com o que um carrossel de verdade tem: uma capa e um slide de conteúdo. */
const SLIDES_EXEMPLO: CarrosselSlideData[] = [
  {
    tipo: "capa",
    titulo: "3 erros que fazem o INSS negar o seu benefício",
    corpo: "O segundo quase ninguém percebe.",
  },
  {
    tipo: "conteudo",
    titulo: "1. Laudo sem a sua rotina",
    corpo:
      "O perito avalia o que está escrito. Se o laudo não mostra o que você deixou de conseguir fazer, a limitação não existe para ele.",
    destaque: "a limitação não existe",
  },
];

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
      <Label
        htmlFor={id}
        className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground"
      >
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

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <Label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Nome de exibição
          </Label>
          <Input
            className="mt-1"
            value={t.nome_exibicao}
            onChange={(e) => set("nome_exibicao", e.target.value)}
            placeholder="Márcia Canuto"
          />
        </div>
        <div>
          <Label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Arroba
          </Label>
          <Input
            className="mt-1"
            value={t.arroba}
            onChange={(e) => set("arroba", e.target.value.replace(/^@/, ""))}
            placeholder="marciacanuto.adv"
          />
        </div>
        <div>
          <Label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Cor de fundo
          </Label>
          <div className="flex gap-2 mt-1">
            <input
              type="color"
              value={t.cor_fundo}
              onChange={(e) => set("cor_fundo", e.target.value)}
              className="h-9 w-12 rounded border border-border bg-background"
            />
            <Input value={t.cor_fundo} onChange={(e) => set("cor_fundo", e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Cor do texto
          </Label>
          <div className="flex gap-2 mt-1">
            <input
              type="color"
              value={t.cor_texto}
              onChange={(e) => set("cor_texto", e.target.value)}
              className="h-9 w-12 rounded border border-border bg-background"
            />
            <Input value={t.cor_texto} onChange={(e) => set("cor_texto", e.target.value)} />
          </div>
        </div>
        <div>
          <Label className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
            Foto de perfil
          </Label>
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
        <div className="flex items-center gap-3 pt-6">
          <Switch checked={t.verificado} onCheckedChange={(v) => set("verificado", v)} />
          <span className="text-sm">Selo de verificado</span>
        </div>
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
        <div className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
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
