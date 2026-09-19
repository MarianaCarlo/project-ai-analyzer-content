import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

function InputPage() {
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setResult(null);
    setLoading(true);

    try {
      const response = await api.post('/summaries', { input_text: inputText });
      setResult(response.data);
    } catch (err) {
      if (err.response?.status === 401) {
        navigate('/login');
      } else {
        setError(err.response?.data?.error || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1>Summarize Content</h1>
      <form onSubmit={handleSubmit}>
        <textarea
          rows={8}
          placeholder="Paste your text here..."
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          required
        />
        <button type="submit" disabled={loading}>
          {loading ? 'Analyzing...' : 'Summarize'}
        </button>
      </form>

      {error && <p style={{ color: 'red' }}>{error}</p>}

      {result && (
        <div>
          <h2>Result</h2>
          <p><strong>Summary:</strong> {result.summary}</p>
          <p><strong>Category:</strong> {result.classification.category}</p>
          <p><strong>Confidence:</strong> {(result.classification.confidence * 100).toFixed(0)}%</p>
          <p style={{ fontStyle: 'italic', fontSize: '0.85em' }}>
            AI-generated — please verify important details.
          </p>
          <button onClick={() => { setInputText(''); setResult(null); }}>
            Summarize another
          </button>
        </div>
      )}

      <p><Link to="/results">View past summaries</Link></p>
    </div>
  );
}

export default InputPage;
