import { Composition, Folder, Still } from "remotion";
import { Carrossel, DURACAO_CARROSSEL } from "./cenas/Carrossel";
import { Configuracao, DURACAO_CONFIGURACAO } from "./cenas/Configuracao";
import { DURACAO_GANCHO, Gancho } from "./cenas/Gancho";
import { DURACAO_OFERTA, Oferta } from "./cenas/Oferta";
import { DURACAO_PLANO_CHEGOU, PlanoChegou } from "./cenas/PlanoChegou";
import { DURACAO_RITMO, Ritmo } from "./cenas/Ritmo";
import { DURACAO_ROTEIRO, Roteiro } from "./cenas/Roteiro";
import { DURACAO_TELEPROMPTER, Teleprompter } from "./cenas/Teleprompter";
import { DURACAO_MESTRE, Mestre } from "./Mestre";
import { duracaoPilula, Pilula } from "./Pilula";
import { Nota } from "./estaticos/Nota";
import { Quiz } from "./estaticos/Quiz";
import { RoteiroCelular } from "./estaticos/RoteiroCelular";
import type { Area } from "./estaticos/areas";
import { DoisPerfis } from "./estaticos/DoisPerfis";
import { DuvidaCliente } from "./estaticos/DuvidaCliente";
import { GanchoAnotado } from "./estaticos/GanchoAnotado";
import { SemanaDecidida } from "./estaticos/SemanaDecidida";

// Criativos estáticos do funil: 3 formatos × 2 textos (A/B) × 2 tamanhos.
const FORMATOS_ESTATICOS = [
  { nome: "1-Quiz", componente: Quiz },
  { nome: "2-Nota", componente: Nota },
  { nome: "4-Roteiro", componente: RoteiroCelular },
] as const;
const TAMANHOS_ESTATICOS = [
  { nome: "4x5", width: 1080, height: 1350 },
  { nome: "9x16", width: 1080, height: 1920 },
] as const;

// Segunda leva: curiosidade e lead qualificado. 1 e 2 variam o título (A/B);
// 3 e 4 têm uma versão por área de atuação.
const AREAS_ESTATICOS: Area[] = ["familia", "previdenciario", "trabalhista"];

// Em 1080×1920 (9:16, WhatsApp) e 1920×1080 (16:9, reuniões), a 30 fps; as
// mesmas cenas servem aos dois (ui/Palco.tsx). As durações vêm da
// narração (voz/tempos.json): se uma fala ficar mais longa, a cena acompanha.
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Mestre"
        component={Mestre}
        durationInFrames={DURACAO_MESTRE}
        fps={30}
        width={1080}
        height={1920}
      />

      <Folder name="Horizontal-16x9">
        <Composition
          id="Mestre-16x9"
          component={Mestre}
          durationInFrames={DURACAO_MESTRE}
          fps={30}
          width={1920}
          height={1080}
        />
        <Composition
          id="Pilula1-Configuracao-16x9"
          component={Pilula}
          durationInFrames={duracaoPilula("configuracao")}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ cena: "configuracao" as const }}
        />
        <Composition
          id="Pilula2-Plano-16x9"
          component={Pilula}
          durationInFrames={duracaoPilula("plano")}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ cena: "plano" as const }}
        />
        <Composition
          id="Pilula3-Roteiro-16x9"
          component={Pilula}
          durationInFrames={duracaoPilula("roteiro")}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ cena: "roteiro" as const }}
        />
        <Composition
          id="Pilula4-Teleprompter-16x9"
          component={Pilula}
          durationInFrames={duracaoPilula("teleprompter")}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ cena: "teleprompter" as const }}
        />
        <Composition
          id="Pilula5-Carrossel-16x9"
          component={Pilula}
          durationInFrames={duracaoPilula("carrossel")}
          fps={30}
          width={1920}
          height={1080}
          defaultProps={{ cena: "carrossel" as const }}
        />
      </Folder>

      <Folder name="Pilulas">
        <Composition
          id="Pilula1-Configuracao"
          component={Pilula}
          durationInFrames={duracaoPilula("configuracao")}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ cena: "configuracao" as const }}
        />
        <Composition
          id="Pilula2-Plano"
          component={Pilula}
          durationInFrames={duracaoPilula("plano")}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ cena: "plano" as const }}
        />
        <Composition
          id="Pilula3-Roteiro"
          component={Pilula}
          durationInFrames={duracaoPilula("roteiro")}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ cena: "roteiro" as const }}
        />
        <Composition
          id="Pilula4-Teleprompter"
          component={Pilula}
          durationInFrames={duracaoPilula("teleprompter")}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ cena: "teleprompter" as const }}
        />
        <Composition
          id="Pilula5-Carrossel"
          component={Pilula}
          durationInFrames={duracaoPilula("carrossel")}
          fps={30}
          width={1080}
          height={1920}
          defaultProps={{ cena: "carrossel" as const }}
        />
      </Folder>

      <Folder name="Estaticos">
        {FORMATOS_ESTATICOS.flatMap((f) =>
          TAMANHOS_ESTATICOS.flatMap((t) =>
            (["A", "B"] as const).map((v) => (
              <Still
                key={`${f.nome}-${v}-${t.nome}`}
                id={`Estatico-${f.nome}-${v}-${t.nome}`}
                component={f.componente}
                width={t.width}
                height={t.height}
                defaultProps={{ variante: v }}
              />
            )),
          ),
        )}
      </Folder>

      <Folder name="Estaticos-curiosidade">
        {TAMANHOS_ESTATICOS.flatMap((t) => [
          ...(["A", "B"] as const).flatMap((v) => [
            <Still
              key={`perfis-${v}-${t.nome}`}
              id={`Criativo-1-DoisPerfis-${v}-${t.nome}`}
              component={DoisPerfis}
              width={t.width}
              height={t.height}
              defaultProps={{ variante: v }}
            />,
            <Still
              key={`gancho-${v}-${t.nome}`}
              id={`Criativo-2-GanchoAnotado-${v}-${t.nome}`}
              component={GanchoAnotado}
              width={t.width}
              height={t.height}
              defaultProps={{ variante: v }}
            />,
          ]),
          ...AREAS_ESTATICOS.flatMap((area) => [
            <Still
              key={`duvida-${area}-${t.nome}`}
              id={`Criativo-3-Duvida-${area}-${t.nome}`}
              component={DuvidaCliente}
              width={t.width}
              height={t.height}
              defaultProps={{ area }}
            />,
            <Still
              key={`semana-${area}-${t.nome}`}
              id={`Criativo-4-Semana-${area}-${t.nome}`}
              component={SemanaDecidida}
              width={t.width}
              height={t.height}
              defaultProps={{ area }}
            />,
          ]),
        ])}
      </Folder>

      <Folder name="Cenas">
        <Composition
          id="Gancho"
          component={Gancho}
          durationInFrames={DURACAO_GANCHO}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Configuracao"
          component={Configuracao}
          durationInFrames={DURACAO_CONFIGURACAO}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="PlanoChegou"
          component={PlanoChegou}
          durationInFrames={DURACAO_PLANO_CHEGOU}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Roteiro"
          component={Roteiro}
          durationInFrames={DURACAO_ROTEIRO}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Teleprompter"
          component={Teleprompter}
          durationInFrames={DURACAO_TELEPROMPTER}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Carrossel"
          component={Carrossel}
          durationInFrames={DURACAO_CARROSSEL}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Ritmo"
          component={Ritmo}
          durationInFrames={DURACAO_RITMO}
          fps={30}
          width={1080}
          height={1920}
        />
        <Composition
          id="Oferta"
          component={Oferta}
          durationInFrames={DURACAO_OFERTA}
          fps={30}
          width={1080}
          height={1920}
        />
      </Folder>
    </>
  );
};
