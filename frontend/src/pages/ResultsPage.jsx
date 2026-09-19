import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../api/client';

function ResultsPage() {
  const [summaries, setSummaries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    async function fetchSummaries() {
      try {
        const response = await api.get('/summaries');
        setSummaries(response.data);
      } catch (err) {
        if (err.response?.status === 401) {
          navigate('/login');
        } else {
          setError('Failed to load summaries.');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchSummaries();
  }, [navigate]);

  if (loading) return <p>Loading your summaries...</p>;
  if (error) return <p style={{ color: 'red' }}>{error}</p>;

  return (
    <div>
      <h1>Your Summaries</h1>
      <p><Link to="/input">Summarize new content</Link></p>

      {summaries.length === 0 ? (
        <p>You haven't summarized anything yet.</p>
      ) : (
        <ul>
          {summaries.map((item) => (
            <li key={item.id}>
              <p><strong>Summary:</strong> {item.summary}</p>
              <p><strong>Category:</strong> {item.classification?.category}</p>
              <p><small>{new Date(item.created_at).toLocaleString()}</small></p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default ResultsPage;
