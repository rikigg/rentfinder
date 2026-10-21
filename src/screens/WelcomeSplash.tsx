import brandPin from "../assets/brand-pin.webp";

type Props = {
  exiting?: boolean;
};

export function WelcomeSplash({ exiting = false }: Props) {
  return (
    <div className={`welcome-splash${exiting ? " welcome-splash--out" : ""}`} aria-hidden>
      <div className="welcome-orb welcome-orb--a" />
      <div className="welcome-orb welcome-orb--b" />
      <div className="welcome-core">
        <img
          className="welcome-logo"
          src={brandPin}
          alt=""
          width={200}
          height={212}
          draggable={false}
          decoding="async"
          fetchPriority="high"
        />
        <div className="welcome-caption">
          <p className="welcome-tag">Найди жильё свайпами</p>
          <div className="welcome-bar" />
        </div>
      </div>
    </div>
  );
}
