import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  BadgeCheck,
  FileCheck,
  RefreshCw,
  Search,
  ShieldCheck,
  UserCheck,
  UserX,
} from 'lucide-react';
import './styles.css';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3003';
const ADMIN_KEY = import.meta.env.VITE_WORKER_ADMIN_KEY || 'change-me-worker-admin-key';
const ADMIN_ID = import.meta.env.VITE_ADMIN_ID || 'local-admin';

async function api(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      'x-admin-id': ADMIN_ID,
      ...(options.headers || {}),
    },
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.message || 'Request failed');
  return body;
}

function App() {
  const [workers, setWorkers] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedWorker, setSelectedWorker] = useState(null);
  const [query, setQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const filteredWorkers = useMemo(() => {
    return workers.filter((worker) => {
      const text = `${worker.fullName} ${worker.phone} ${worker.city} ${worker.workArea}`.toLowerCase();
      const matchesQuery = text.includes(query.trim().toLowerCase());
      const matchesStatus = statusFilter === 'all' || worker.workerStatus === statusFilter;
      return matchesQuery && matchesStatus;
    });
  }, [workers, query, statusFilter]);

  async function loadWorkers() {
    setLoading(true);
    setError('');
    try {
      const data = await api('/api/admin/workers');
      setWorkers(data.workers);
      if (!selectedId && data.workers.length > 0) {
        setSelectedId(data.workers[0].id);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function loadWorker(id) {
    if (!id) return;
    setError('');
    try {
      const data = await api(`/api/admin/workers/${id}`);
      setSelectedWorker(data.worker);
    } catch (err) {
      setError(err.message);
    }
  }

  async function simulateKyc(decision) {
    if (!selectedWorker) return;
    setSaving(true);
    setError('');
    const faceMatchScore =
      decision === 'verified' ? 94 : decision === 'manual_review' ? 78 : 42;
    try {
      await api(`/api/admin/workers/${selectedWorker.id}/kyc/simulate`, {
        method: 'POST',
        body: JSON.stringify({
          decision,
          faceMatchScore,
          reason: `Admin simulated ${decision} for local HyperVerge flow`,
        }),
      });
      await loadWorkers();
      await loadWorker(selectedWorker.id);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  useEffect(() => {
    loadWorkers();
  }, []);

  useEffect(() => {
    loadWorker(selectedId);
  }, [selectedId]);

  const stats = useMemo(() => {
    return {
      total: workers.length,
      verified: workers.filter((worker) => worker.workerStatus === 'verified').length,
      pending: workers.filter((worker) => worker.workerStatus === 'kyc_pending').length,
      review: workers.filter((worker) => worker.workerStatus === 'manual_review').length,
    };
  }, [workers]);

  return (
    <main className="app">
      <aside className="sidebar">
        <div className="brand">
          <ShieldCheck size={28} />
          <div>
            <h1>Gofer Admin</h1>
            <span>Worker verification</span>
          </div>
        </div>

        <div className="stat-grid">
          <Metric label="Total" value={stats.total} />
          <Metric label="Verified" value={stats.verified} />
          <Metric label="Pending" value={stats.pending} />
          <Metric label="Review" value={stats.review} />
        </div>

        <div className="filters">
          <label className="search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search workers"
            />
          </label>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="all">All statuses</option>
            <option value="kyc_pending">KYC pending</option>
            <option value="verified">Verified</option>
            <option value="manual_review">Manual review</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <button className="refresh" onClick={loadWorkers} disabled={loading}>
          <RefreshCw size={16} />
          Refresh
        </button>

        <div className="worker-list">
          {filteredWorkers.map((worker) => (
            <button
              key={worker.id}
              className={`worker-row ${worker.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(worker.id)}
            >
              <span>{worker.fullName}</span>
              <small>{worker.phone} · {worker.city}</small>
              <StatusBadge status={worker.workerStatus} />
            </button>
          ))}
        </div>
      </aside>

      <section className="content">
        {error && <div className="error">{error}</div>}
        {!selectedWorker ? (
          <div className="empty">Select a worker to review.</div>
        ) : (
          <>
            <header className="worker-header">
              <div>
                <h2>{selectedWorker.fullName}</h2>
                <p>{selectedWorker.phone} · {selectedWorker.city} · {selectedWorker.workArea}</p>
              </div>
              <StatusBadge status={selectedWorker.workerStatus} large />
            </header>

            <div className="panel-grid">
              <section className="panel">
                <h3>Profile</h3>
                <Info label="Age" value={selectedWorker.age || '-'} />
                <Info label="Language" value={selectedWorker.language} />
                <Info label="Worker type" value={(selectedWorker.enrollmentTypes || []).join(', ')} />
                <Info label="Experience" value={selectedWorker.experience} />
                <Info label="Travel radius" value={`${selectedWorker.travelRadiusKm} km`} />
                <Info label="Consent" value={selectedWorker.consentAccepted ? 'Accepted' : 'Missing'} />
                <Info label="Consent version" value={selectedWorker.consentVersion || '-'} />
              </section>

              <section className="panel">
                <h3>KYC Status</h3>
                <Info label="Provider" value={selectedWorker.kycProvider || 'mock_hyperverge'} />
                <Info label="KYC" value={selectedWorker.kycStatus || 'not_started'} />
                <Info label="Reference" value={selectedWorker.kycReferenceId || '-'} />
                <Info label="Completed" value={formatDate(selectedWorker.kycCompletedAt)} />
                <div className="actions">
                  <button onClick={() => simulateKyc('verified')} disabled={saving}>
                    <UserCheck size={16} />
                    Mark Verified
                  </button>
                  <button onClick={() => simulateKyc('manual_review')} disabled={saving}>
                    <BadgeCheck size={16} />
                    Manual Review
                  </button>
                  <button className="danger" onClick={() => simulateKyc('failed')} disabled={saving}>
                    <UserX size={16} />
                    Reject
                  </button>
                </div>
              </section>
            </div>

            <section className="panel documents">
              <h3>Documents</h3>
              {(selectedWorker.documents || []).map((document) => (
                <div className="document-row" key={document.id}>
                  <FileCheck size={20} />
                  <div>
                    <strong>{document.documentType}</strong>
                    <span>{document.idType || 'ID'} · {document.storageProvider}</span>
                  </div>
                  <code>{document.storageKey}</code>
                </div>
              ))}
            </section>

            <section className="panel">
              <h3>KYC History</h3>
              {(selectedWorker.kycVerifications || []).map((kyc) => (
                <div className="history-row" key={kyc.id}>
                  <StatusBadge status={kyc.status} />
                  <span>{kyc.provider}</span>
                  <span>Face {kyc.faceMatchScore || '-'}%</span>
                  <span>{kyc.decisionReason || '-'}</span>
                  <small>{formatDate(kyc.processedAt || kyc.createdAt)}</small>
                </div>
              ))}
            </section>
          </>
        )}
      </section>
    </main>
  );
}

function Metric({ label, value }) {
  return (
    <div className="metric">
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Info({ label, value }) {
  return (
    <div className="info">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function StatusBadge({ status, large = false }) {
  const normalized = status || 'unknown';
  return <span className={`status ${large ? 'large' : ''} ${normalized}`}>{normalized.replace('_', ' ')}</span>;
}

function formatDate(value) {
  if (!value) return '-';
  return new Date(value).toLocaleString();
}

createRoot(document.getElementById('root')).render(<App />);
