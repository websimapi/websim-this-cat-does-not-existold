const { useState, useEffect, useMemo } = React;
const { createRoot } = ReactDOM;

const App = () => {
  const [room] = useState(() => new WebsimSocket());
  const [isGenerating, setIsGenerating] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [selectedCat, setSelectedCat] = useState(null);
  
  // Get live updates from the database
  const cats = React.useSyncExternalStore(
    room.collection('cat').subscribe,
    () => room.collection('cat').getList()
  );
  
  const peers = React.useSyncExternalStore(
    room.party.subscribe,
    () => room.party.peers
  );

  const sortedCats = useMemo(() => {
    return [...cats].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  }, [cats]);

  const generateCat = async () => {
    if (!prompt.trim() || isGenerating) return;
    
    setIsGenerating(true);
    
    try {
      // Step 1: Generate cat description from prompt
      const catDescriptionResponse = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are a creative cat description generator. Your job is to take a simple cat prompt and create a detailed, whimsical, and creative description of a cat that does not exist. 
            Include details about appearance, personality, and a fictional background. Make it vivid and specific.
            Keep descriptions between 100-200 words. Focus only on cats, regardless of what the user requests.`
          },
          {
            role: "user",
            content: prompt
          }
        ]
      });
      
      const catDescription = catDescriptionResponse.content;
      
      // Step 2: Generate image from description
      const imageGenPrompt = `Photorealistic cat: ${catDescription}. Highly detailed, studio lighting, 8k resolution.`;
      const imageResult = await websim.imageGen({
        prompt: imageGenPrompt,
        aspect_ratio: "1:1"
      });
      
      // Step 3: Store both in database
      await room.collection('cat').create({
        prompt: prompt,
        description: catDescription,
        imageUrl: imageResult.url,
        title: await generateTitle(catDescription)
      });
      
      // Reset form
      setPrompt('');
    } catch (error) {
      console.error('Error generating cat:', error);
      alert('Failed to generate cat. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };
  
  const generateTitle = async (description) => {
    try {
      const titleResponse = await websim.chat.completions.create({
        messages: [
          {
            role: "system",
            content: "Generate a short, creative title (max 5 words) for this cat description. Make it catchy and related to the cat's most distinctive trait."
          },
          {
            role: "user",
            content: description
          }
        ]
      });
      
      return titleResponse.content;
    } catch (error) {
      console.error('Error generating title:', error);
      return "Mysterious Feline";
    }
  };

  return (
    <div className="app-container">
      <header className="header">
        <h1>This Cat Does Not Exist</h1>
        <p>Generate imaginary cats with AI - they're purr-fectly unreal!</p>
      </header>
      
      <OnlineUsers peers={peers} />
      
      <section className="generator-form">
        <div className="form-group">
          <label htmlFor="prompt">Describe your imaginary cat:</label>
          <textarea
            id="prompt"
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            placeholder="e.g., A cyberpunk cat with neon fur that glows in the dark"
            disabled={isGenerating}
          />
        </div>
        
        <button 
          className="btn" 
          onClick={generateCat} 
          disabled={isGenerating || !prompt.trim()}
        >
          {isGenerating ? (
            <>
              <span className="generating-spinner"></span>
              Generating...
            </>
          ) : 'Generate Cat'}
        </button>
        
        {isGenerating && (
          <p className="generating-info">
            Creating your imaginary cat... First crafting a description, then visualizing it.
          </p>
        )}
      </section>
      
      <section className="cat-gallery">
        {sortedCats.length === 0 ? (
          <p>No cats generated yet. Be the first to create an imaginary cat!</p>
        ) : (
          sortedCats.map(cat => (
            <CatCard 
              key={cat.id} 
              cat={cat} 
              onClick={() => setSelectedCat(cat)} 
            />
          ))
        )}
      </section>
      
      {selectedCat && (
        <CatDetailModal 
          cat={selectedCat} 
          onClose={() => setSelectedCat(null)} 
        />
      )}
    </div>
  );
};

const CatCard = ({ cat, onClick }) => {
  return (
    <div className="cat-card" onClick={onClick}>
      <img 
        src={cat.imageUrl} 
        alt={cat.title} 
        className="cat-image"
        loading="lazy"
      />
      <div className="cat-content">
        <h3>{cat.title}</h3>
        <p>{cat.description.substring(0, 100)}...</p>
        <div className="cat-creator">
          <img 
            src={`https://images.websim.ai/avatar/${cat.username}`} 
            alt={cat.username} 
            className="user-avatar" 
          />
          <span>Created by {cat.username}</span>
        </div>
      </div>
    </div>
  );
};

const CatDetailModal = ({ cat, onClose }) => {
  useEffect(() => {
    const handleEsc = (e) => {
      if (e.key === 'Escape') onClose();
    };
    
    window.addEventListener('keydown', handleEsc);
    return () => window.removeEventListener('keydown', handleEsc);
  }, [onClose]);

  return (
    <div className="cat-detail-modal" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>×</button>
        <img 
          src={cat.imageUrl} 
          alt={cat.title} 
          className="modal-image" 
        />
        <div className="modal-body">
          <h2 className="modal-title">{cat.title}</h2>
          <p className="modal-description">{cat.description}</p>
          <div className="cat-creator">
            <img 
              src={`https://images.websim.ai/avatar/${cat.username}`} 
              alt={cat.username} 
              className="user-avatar" 
            />
            <span>Created by {cat.username} • {new Date(cat.created_at).toLocaleDateString()}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

const OnlineUsers = ({ peers }) => {
  const peersList = Object.values(peers);
  
  return (
    <div className="online-users">
      <h3>
        {peersList.length} {peersList.length === 1 ? 'person' : 'people'} online
      </h3>
      <div className="users-list">
        {peersList.map(peer => (
          <div key={peer.id} className="user-badge">
            <img 
              src={`https://images.websim.ai/avatar/${peer.username}`} 
              alt={peer.username} 
              className="user-avatar" 
            />
            <span>{peer.username}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

createRoot(document.getElementById('root')).render(<App />);

