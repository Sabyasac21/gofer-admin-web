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
  if (window.location.pathname === '/privacy') {
    return <PrivacyPolicy />;
  }

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

function PrivacyPolicy() {
  return (
    <main className="policy-page">
      <article className="policy">
        <p className="policy-kicker">Gofer Worker</p>
        <h1>Privacy Policy</h1>
        <p className="policy-updated">Last updated: July 1, 2026</p>

        <p>
          This Privacy Policy explains how Gofer Worker collects, uses, stores, and shares
          information when workers use the Gofer Worker mobile application to enroll,
          complete verification, and access worker-related services.
        </p>

        <h2>Information We Collect</h2>
        <p>We may collect the following information from workers:</p>
        <ul>
          <li>Personal details such as full name, phone number, age, language, city, and work area.</li>
          <li>Worker profile details such as worker type, professional categories, experience, travel radius, and emergency contact if provided.</li>
          <li>Identity verification information such as ID document images, selfie images, ID type, consent status, KYC status, and verification results.</li>
          <li>Technical information such as device, app, and request information needed to operate, secure, and troubleshoot the service.</li>
        </ul>

        <h2>How We Use Information</h2>
        <p>We use worker information to:</p>
        <ul>
          <li>Create and manage worker enrollment profiles.</li>
          <li>Verify worker identity, eligibility, and profile authenticity.</li>
          <li>Protect customers, workers, and the Gofer platform from fraud, misuse, and safety risks.</li>
          <li>Review, approve, reject, or request manual review of worker applications.</li>
          <li>Provide worker app functionality, support, service updates, and operational communication.</li>
          <li>Comply with legal, regulatory, security, and dispute resolution requirements.</li>
        </ul>

        <h2>Consent For Verification</h2>
        <p>
          Before submitting identity documents or selfie images, workers are asked to provide
          consent for verification. Verification information may be processed by Gofer and by
          trusted verification providers for identity checks, document checks, face matching,
          liveness checks, background checks, fraud prevention, and platform safety.
        </p>

        <h2>Sharing Of Information</h2>
        <p>We do not sell worker personal information. We may share information only when needed with:</p>
        <ul>
          <li>Service providers that host, store, process, or secure app and backend data.</li>
          <li>Identity verification and KYC providers such as HyperVerge or similar providers when verification is enabled.</li>
          <li>Gofer administrators and authorized operations staff who need access for verification, support, safety, or compliance.</li>
          <li>Government, law enforcement, or legal authorities when required by applicable law or valid legal process.</li>
        </ul>

        <h2>Data Storage And Security</h2>
        <p>
          We use reasonable technical and organizational safeguards to protect worker data.
          Data is transmitted using HTTPS where supported. Identity documents and selfie images
          are intended to be stored in private storage and accessed only for verification,
          support, safety, or compliance purposes.
        </p>

        <h2>Data Retention</h2>
        <p>
          We keep worker information only for as long as needed for enrollment, verification,
          worker account management, customer safety, fraud prevention, legal compliance, and
          business record purposes. If a worker requests deletion, we will delete or anonymize
          eligible information unless we need to retain it for legal, safety, fraud prevention,
          dispute, or compliance reasons.
        </p>

        <h2>Worker Choices And Deletion Requests</h2>
        <p>
          Workers may request access, correction, or deletion of their information by contacting
          us. We may need to verify the requester before processing the request.
        </p>

        <h2>Children</h2>
        <p>
          Gofer Worker is intended for adults who want to enroll as workers. It is not intended
          for children, and we do not knowingly collect personal information from children.
        </p>

        <h2>Changes To This Policy</h2>
        <p>
          We may update this Privacy Policy from time to time. Any changes will be posted on
          this page with an updated date.
        </p>

        <h2>Contact Us</h2>
        <p>
          For privacy questions, support, correction, or deletion requests, contact us at:{' '}
          <a href="mailto:sabyasachinishant100@gmail.com">sabyasachinishant100@gmail.com</a>
        </p>
      </article>
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
