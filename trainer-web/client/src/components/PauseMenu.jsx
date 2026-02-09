import { useNavigate } from 'react-router-dom';

export default function PauseMenu({ onResume, onRestart, onExit }) {
  const navigate = useNavigate();
  
  const handleExit = () => {
    if (onExit) onExit();
    navigate('/dashboard');
  };
  
  return (
    <div className="pause-menu-overlay">
      <div className="pause-menu">
        <h2 className="pause-menu__title">PAUSED</h2>
        
        <div className="pause-menu__buttons">
          <button 
            className="btn btn--primary btn--lg"
            onClick={onResume}
          >
            Resume (ESC)
          </button>
          
          <button 
            className="btn btn--secondary btn--lg"
            onClick={onRestart}
          >
            Restart
          </button>
          
          <button 
            className="btn btn--outline btn--lg"
            onClick={handleExit}
          >
            Exit to Dashboard
          </button>
        </div>
        
        <div className="pause-menu__hint">
          <p>Press ESC to resume</p>
        </div>
      </div>
    </div>
  );
}
