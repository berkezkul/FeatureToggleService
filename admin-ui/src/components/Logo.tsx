import zebraLogo from '../assets/zebra_logo.png';

export const Logo = () => {
  return (
    <div className="logo">
      <img src={zebraLogo} alt="Zebra Electronics" className="logo-image" />
      <div className="logo-text">
        <span className="logo-subtitle">Feature Toggle Admin</span>
      </div>
    </div>
  );
};

