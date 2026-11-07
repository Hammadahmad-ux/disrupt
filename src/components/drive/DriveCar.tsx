import body900avif from "./assets/body-900.avif";
import body900webp from "./assets/body-900.webp";
import body1800avif from "./assets/body-1800.avif";
import body1800webp from "./assets/body-1800.webp";
import rimFront256avif from "./assets/rim-front-256.avif";
import rimFront256webp from "./assets/rim-front-256.webp";
import rimFront512avif from "./assets/rim-front-512.avif";
import rimFront512webp from "./assets/rim-front-512.webp";
import rimRear256avif from "./assets/rim-rear-256.avif";
import rimRear256webp from "./assets/rim-rear-256.webp";
import rimRear512avif from "./assets/rim-rear-512.avif";
import rimRear512webp from "./assets/rim-rear-512.webp";
import { rimBox } from "./drive-geometry";
import styles from "./drive.module.css";

const CAR_SIZES = "(max-width: 900px) 72vw, 36vw";
const RIM_SIZES = "(max-width: 900px) 9vw, 5vw";

const RIMS = {
  front: { a: [rimFront256avif, rimFront512avif], w: [rimFront256webp, rimFront512webp] },
  rear: { a: [rimRear256avif, rimRear512avif], w: [rimRear256webp, rimRear512webp] },
} as const;

const set = (pair: readonly { src: string }[]) => `${pair[0].src} 256w, ${pair[1].src} 512w`;

/** "DISRUPT" printed twice round the tyre sidewall, like tyre-maker lettering; it turns with the rim. */
function TyreLettering({ id }: { id: string }) {
  const path = `tyre-arc-${id}`;
  return (
    <svg className={styles.tyreText} viewBox="0 0 100 100" aria-hidden="true">
      <defs>
        <path id={path} d="M50 50 m-45.5 0 a45.5 45.5 0 1 1 91 0 a45.5 45.5 0 1 1 -91 0" />
      </defs>
      <text>
        <textPath href={`#${path}`} startOffset="0">
          DISRUPT
        </textPath>
        <textPath href={`#${path}`} startOffset="50%">
          DISRUPT
        </textPath>
      </text>
    </svg>
  );
}

function Rim({ which, className, data, lettering = false }: { which: "front" | "rear"; className: string; data: string; lettering?: boolean }) {
  const r = RIMS[which];
  return (
    <span className={className} {...{ [data]: which }}>
      <picture>
        <source type="image/avif" srcSet={set(r.a)} sizes={RIM_SIZES} />
        <img src={r.w[0].src} srcSet={set(r.w)} sizes={RIM_SIZES} width={256} height={256} alt="" loading="lazy" decoding="async" draggable={false} />
      </picture>
      {lettering && <TyreLettering id={which} />}
    </span>
  );
}

// The client's Audi RS5 Estate (CGI cut-out, facing right) with its two rim discs laid over the hubs.
// DriveWork turns the rims by the distance travelled; the reflection copy skips the motion-blur rims.
export default function DriveCar({ reflection = false }: { reflection?: boolean }) {
  return (
    <div className={styles.chassis} data-chassis>
      <picture>
        <source type="image/avif" srcSet={`${body900avif.src} 900w, ${body1800avif.src} 1800w`} sizes={CAR_SIZES} />
        <img
          className={styles.body}
          src={body900webp.src}
          srcSet={`${body900webp.src} 900w, ${body1800webp.src} 1800w`}
          sizes={CAR_SIZES}
          width={body1800webp.width}
          height={body1800webp.height}
          alt=""
          loading="lazy"
          decoding="async"
          draggable={false}
        />
      </picture>
      {(["rear", "front"] as const).map((w) => (
        <span key={w} className={styles.wheel} style={rimBox(w)}>
          <Rim which={w} className={styles.rim} data="data-rim" lettering />
          {!reflection && <Rim which={w} className={styles.rimBlur} data="data-rim-blur" />}
        </span>
      ))}
    </div>
  );
}
