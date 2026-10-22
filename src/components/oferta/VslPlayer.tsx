import { useEffect, useRef, useState } from "react";
import { Pause, Play, Volume2 } from "lucide-react";

/**
 * Player de VSL (como o do Panda Vídeo), para o vídeo do relatório.
 *
 * - Começa sozinho e sem som: navegador nenhum deixa autoplay com áudio. O
 *   aviso "Toque para ouvir" volta o vídeo para o início já com som.
 * - Sem controles nativos: não dá para avançar nem ver quanto falta. Tocar no
 *   vídeo só pausa e continua.
 * - Barra de progresso falsa: anda rápido no começo e devagar no fim, para o
 *   vídeo parecer mais curto do que é.
 * - `onMarco` dispara uma vez quando o vídeo passa de `marcoSegundos`; quem usa
 *   decide o que liberar. `onErro` dispara se o vídeo não carregar, para quem
 *   usa não deixar a página travada atrás de um vídeo quebrado.
 *
 * Toca HLS (.m3u8) nativo no Safari e com hls.js nos outros; MP4 direto em
 * qualquer um.
 */
export function VslPlayer({
  src,
  poster,
  marcoSegundos,
  onMarco,
  onErro,
}: {
  src: string;
  poster?: string;
  marcoSegundos: number;
  onMarco: () => void;
  onErro: () => void;
}) {
  const video = useRef<HTMLVideoElement>(null);
  const marcoDisparado = useRef(false);
  const [previa, setPrevia] = useState(true);
  const [pausado, setPausado] = useState(false);
  const [progresso, setProgresso] = useState(0);

  useEffect(() => {
    const v = video.current;
    if (!v) return;
    let hls: { destroy: () => void } | null = null;
    let cancelado = false;

    const tocarSemSom = () => {
      v.muted = true;
      // Autoplay bloqueado (modo economia de dados, por exemplo): fica parado
      // com o aviso, e o toque começa o vídeo.
      v.play().catch(() => setPausado(true));
    };

    const ehHls = /\.m3u8(\?|$)/i.test(src);
    if (!ehHls || v.canPlayType("application/vnd.apple.mpegurl")) {
      v.src = src;
      tocarSemSom();
    } else {
      import("hls.js")
        .then(({ default: Hls }) => {
          if (cancelado) return;
          if (!Hls.isSupported()) {
            onErro();
            return;
          }
          const h = new Hls({ capLevelToPlayerSize: true });
          h.on(Hls.Events.ERROR, (_e, dados) => {
            if (dados.fatal) onErro();
          });
          h.loadSource(src);
          h.attachMedia(v);
          hls = h;
          tocarSemSom();
        })
        .catch(onErro);
    }

    return () => {
      cancelado = true;
      hls?.destroy();
    };
    // `src` é a única coisa que troca o vídeo; os callbacks são estáveis o
    // bastante e não devem reiniciar o player.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  function aoAtualizarTempo() {
    const v = video.current;
    if (!v) return;
    if (v.duration > 0 && Number.isFinite(v.duration)) {
      // x^0,5: 25% do vídeo mostra metade da barra, e o fim chega devagar.
      setProgresso(Math.min(1, Math.sqrt(v.currentTime / v.duration)));
    }
    if (!marcoDisparado.current && v.currentTime >= marcoSegundos) {
      marcoDisparado.current = true;
      onMarco();
    }
  }

  function aoTocar() {
    const v = video.current;
    if (!v) return;
    if (previa) {
      // Saiu da prévia sem som: recomeça do início, agora valendo.
      setPrevia(false);
      v.currentTime = 0;
      v.muted = false;
      void v.play().then(
        () => setPausado(false),
        () => setPausado(true),
      );
      return;
    }
    if (v.paused) {
      void v.play().then(
        () => setPausado(false),
        () => setPausado(true),
      );
    } else {
      v.pause();
      setPausado(true);
    }
  }

  return (
    <div
      className="relative mx-auto mt-6 aspect-[9/16] max-h-[min(70vh,560px)] w-full max-w-[315px] overflow-hidden
        rounded-xl border border-border bg-foreground"
      data-print-hide
    >
      <video
        ref={video}
        poster={poster}
        playsInline
        preload="auto"
        disablePictureInPicture
        controlsList="nodownload noplaybackrate noremoteplayback nofullscreen"
        onContextMenu={(e) => e.preventDefault()}
        onTimeUpdate={aoAtualizarTempo}
        onEnded={() => {
          setPausado(true);
          setProgresso(1);
          if (!marcoDisparado.current) {
            marcoDisparado.current = true;
            onMarco();
          }
        }}
        onError={onErro}
        className="h-full w-full object-cover"
      />

      {/* A camada inteira é o botão: não há controle nenhum além dela. */}
      <button
        type="button"
        onClick={aoTocar}
        aria-label={
          previa ? "Ativar o som do vídeo" : pausado ? "Continuar o vídeo" : "Pausar o vídeo"
        }
        className="absolute inset-0 flex items-center justify-center focus-visible:outline-none
          focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        {previa ? (
          <span className="mx-6 flex flex-col items-center gap-2 rounded-xl bg-primary px-5 py-4 text-center text-primary-foreground shadow-lg">
            <Volume2 className="h-8 w-8" />
            <span className="text-sm font-semibold leading-tight">Seu vídeo já começou</span>
            <span className="text-sm leading-tight">Toque para ouvir</span>
          </span>
        ) : pausado ? (
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
            <Play className="ml-1 h-8 w-8" />
          </span>
        ) : (
          <span className="sr-only">
            <Pause />
          </span>
        )}
      </button>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1.5 bg-white/25">
        <div
          className="h-full bg-primary transition-[width] duration-300 ease-linear"
          style={{ width: `${progresso * 100}%` }}
        />
      </div>
    </div>
  );
}
