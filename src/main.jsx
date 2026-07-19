import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  BadgeCheck,
  Bell,
  BriefcaseBusiness,
  CircleAlert,
  CircleCheck,
  FileCheck,
  LocateFixed,
  MapPin,
  RefreshCw,
  Search,
  ShieldCheck,
  Timer,
  UserCheck,
  UserX,
  Wifi,
  WifiOff,
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
  if (window.location.pathname === '/account-deletion') {
    return <AccountDeletion />;
  }

  if (window.location.pathname === '/privacy') {
    return <PrivacyPolicy />;
  }

  const [view, setView] = useState('availability');
  return view === 'availability'
    ? <AvailabilityDashboard onVerification={() => setView('verification')} />
    : <VerificationAdmin onAvailability={() => setView('availability')} />;
}

function VerificationAdmin({ onAvailability }) {
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

        <div className="view-switch">
          <button onClick={onAvailability}>
            <Activity size={16} />
            Availability
          </button>
          <button className="active">
            <ShieldCheck size={16} />
            Verification
          </button>
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

const CHECK_LABELS = {
  verified: 'Worker verified',
  presenceRegistered: 'Presence registered',
  onlineEnabled: 'Online enabled',
  presenceFresh: 'Presence within 12-hour lease',
  notificationReady: 'Notification token ready',
  locationReady: 'Current location ready',
  serviceEligible: 'Service type/category eligible',
  available: 'No active assignment',
  withinTravelRadius: 'Within travel radius',
};

function AvailabilityDashboard({ onVerification }) {
  const [data, setData] = useState({
    workers: [],
    totals: {},
    regions: [],
    generatedAt: null,
  });
  const [selectedId, setSelectedId] = useState(null);
  const [query, setQuery] = useState('');
  const [region, setRegion] = useState('');
  const [status, setStatus] = useState('all');
  const [loading, setLoading] = useState(false);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(null);
  const [criteria, setCriteria] = useState({
    serviceType: 'helper',
    category: 'Cleaning',
    latitude: '28.6274',
    longitude: '77.3723',
  });

  async function loadAvailability({ silent = false } = {}) {
    if (!silent) setLoading(true);
    setError('');
    try {
      const result = await api('/api/admin/worker-availability');
      setData(result);
      setSelectedId((current) => {
        if (current && result.workers.some((worker) => worker.id === current)) {
          return current;
        }
        return result.workers[0]?.id || null;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  }

  async function runPreview(event) {
    event.preventDefault();
    setPreviewLoading(true);
    setError('');
    try {
      const result = await api('/api/admin/matching-preview', {
        method: 'POST',
        body: JSON.stringify({
          serviceType: criteria.serviceType,
          category: criteria.category || null,
          latitude: Number(criteria.latitude),
          longitude: Number(criteria.longitude),
          region: region || null,
        }),
      });
      setPreview(result);
      setSelectedId(result.eligible[0]?.id || result.excluded[0]?.id || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setPreviewLoading(false);
    }
  }

  useEffect(() => {
    loadAvailability();
  }, []);

  useEffect(() => {
    const timer = window.setInterval(
      () => loadAvailability({ silent: true }),
      15000,
    );
    return () => window.clearInterval(timer);
  }, []);

  const regionOptions = useMemo(() => {
    const values = new Set(data.workers.map((worker) => worker.region));
    data.regions.forEach((item) => values.add(item.region));
    return [...values].filter(Boolean).sort();
  }, [data]);

  const filteredWorkers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return data.workers.filter((worker) => {
      const haystack = [
        worker.fullName,
        worker.phone,
        worker.city,
        worker.workArea,
        worker.region,
        ...(worker.enrollmentTypes || []),
        ...(worker.professionalCategories || []),
      ].join(' ').toLowerCase();
      return (!normalized || haystack.includes(normalized)) &&
        (!region || worker.region === region) &&
        (status === 'all' || worker.status === status);
    });
  }, [data.workers, query, region, status]);

  const selectedWorker =
    data.workers.find((worker) => worker.id === selectedId) || null;

  return (
    <main className="app operations-app">
      <aside className="sidebar">
        <div className="brand">
          <Activity size={28} />
          <div>
            <h1>Gofer Admin</h1>
            <span>Worker operations</span>
          </div>
        </div>

        <div className="view-switch">
          <button className="active">
            <Activity size={16} />
            Availability
          </button>
          <button onClick={onVerification}>
            <ShieldCheck size={16} />
            Verification
          </button>
        </div>

        <div className="stat-grid availability-stats">
          <Metric label="Workers" value={data.totals.total || 0} />
          <Metric label="Ready now" value={data.totals.ready || 0} tone="ready" />
          <Metric label="Busy" value={data.totals.busy || 0} />
          <Metric label="Blocked" value={(data.totals.blocked || 0) + (data.totals.stale || 0)} />
        </div>

        <div className="filters">
          <label className="search">
            <Search size={18} />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search worker or region"
            />
          </label>
          <select value={region} onChange={(event) => setRegion(event.target.value)}>
            <option value="">All regions</option>
            {regionOptions.map((item) => (
              <option value={item} key={item}>{item}</option>
            ))}
          </select>
          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="all">All availability states</option>
            <option value="ready">Ready</option>
            <option value="busy">Busy</option>
            <option value="offline">Offline</option>
            <option value="stale">Stale</option>
            <option value="notification_unavailable">Notification unavailable</option>
            <option value="location_unavailable">Location unavailable</option>
            <option value="online_not_eligible">Online, not eligible</option>
            <option value="not_verified">Not verified</option>
          </select>
        </div>

        <button className="refresh" onClick={() => loadAvailability()} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'spin' : ''} />
          {loading ? 'Refreshing' : 'Refresh availability'}
        </button>

        <div className="worker-list">
          {filteredWorkers.map((worker) => (
            <button
              key={worker.id}
              className={`worker-row availability-row ${worker.id === selectedId ? 'active' : ''}`}
              onClick={() => setSelectedId(worker.id)}
            >
              <span className="worker-row-title">
                <PresenceDot status={worker.status} />
                {worker.fullName}
              </span>
              <small>{worker.region} · {formatRelative(worker.lastSeenAt)}</small>
              <AvailabilityBadge status={worker.status} />
            </button>
          ))}
          {!loading && filteredWorkers.length === 0 && (
            <div className="list-empty">No workers match these filters.</div>
          )}
        </div>
      </aside>

      <section className="content operations-content">
        {error && <div className="error">{error}</div>}
        <header className="operations-header">
          <div>
            <p className="eyebrow">LIVE OPERATIONS</p>
            <h2>Regional worker availability</h2>
            <p>
              Eligibility is evaluated from verification, presence, push token,
              location, service capability, active jobs and travel radius.
            </p>
          </div>
          <div className="updated-at">
            <Timer size={17} />
            Updated {formatRelative(data.generatedAt)}
          </div>
        </header>

        <div className="region-grid">
          {data.regions.slice(0, 6).map((item) => (
            <button
              className={`region-card ${region === item.region ? 'active' : ''}`}
              key={item.region}
              onClick={() => setRegion(region === item.region ? '' : item.region)}
            >
              <MapPin size={18} />
              <strong>{item.region}</strong>
              <span>{item.ready} ready · {item.busy} busy · {item.total} total</span>
            </button>
          ))}
        </div>

        <form className="panel preview-panel" onSubmit={runPreview}>
          <div className="panel-heading">
            <div>
              <p className="eyebrow">TASK SIMULATOR</p>
              <h3>Preview production eligibility</h3>
            </div>
            {preview && (
              <span className="preview-result">
                {preview.counts.eligible} of {preview.counts.evaluated} eligible
              </span>
            )}
          </div>
          <div className="preview-fields">
            <label>
              Worker type
              <select
                value={criteria.serviceType}
                onChange={(event) => setCriteria({ ...criteria, serviceType: event.target.value })}
              >
                <option value="helper">Helper</option>
                <option value="professional">Professional</option>
              </select>
            </label>
            <label>
              Category
              <input
                value={criteria.category}
                onChange={(event) => setCriteria({ ...criteria, category: event.target.value })}
                placeholder="Cleaning"
              />
            </label>
            <label>
              Latitude
              <input
                type="number"
                step="any"
                required
                value={criteria.latitude}
                onChange={(event) => setCriteria({ ...criteria, latitude: event.target.value })}
              />
            </label>
            <label>
              Longitude
              <input
                type="number"
                step="any"
                required
                value={criteria.longitude}
                onChange={(event) => setCriteria({ ...criteria, longitude: event.target.value })}
              />
            </label>
            <button type="submit" disabled={previewLoading}>
              <LocateFixed size={17} />
              {previewLoading ? 'Evaluating' : 'Run preview'}
            </button>
          </div>
        </form>

        {!selectedWorker ? (
          <div className="empty">Select a worker to inspect availability.</div>
        ) : (
          <WorkerAvailabilityDetail
            worker={
              preview?.eligible.find((item) => item.id === selectedWorker.id) ||
              preview?.excluded.find((item) => item.id === selectedWorker.id) ||
              selectedWorker
            }
            taskSpecific={Boolean(preview)}
          />
        )}
      </section>
    </main>
  );
}

function WorkerAvailabilityDetail({ worker, taskSpecific }) {
  const checkEntries = Object.entries(worker.checks || {})
    .filter(([key]) => taskSpecific || !['serviceEligible', 'withinTravelRadius'].includes(key));
  return (
    <section className="availability-detail">
      <header className="worker-header">
        <div>
          <div className="worker-title-line">
            <h2>{worker.fullName}</h2>
            <AvailabilityBadge status={worker.status} large />
          </div>
          <p>{worker.phone} · {worker.region}</p>
        </div>
        <div className="online-duration">
          <Wifi size={18} />
          <span>{worker.onlineSince ? `Online ${formatDuration(worker.onlineSince)}` : 'No active online session'}</span>
        </div>
      </header>

      <div className="panel-grid availability-panels">
        <section className="panel">
          <h3>Live presence</h3>
          <Info label="Registered region" value={worker.region || '-'} />
          <Info label="City / work area" value={`${worker.city || '-'} / ${worker.workArea || '-'}`} />
          <Info label="Last heartbeat" value={formatDate(worker.lastSeenAt)} />
          <Info label="Heartbeat age" value={formatAge(worker.presenceAgeSeconds)} />
          <Info label="Location updated" value={formatDate(worker.locationUpdatedAt)} />
          <Info
            label="Coordinates"
            value={worker.latitude == null ? '-' : `${Number(worker.latitude).toFixed(5)}, ${Number(worker.longitude).toFixed(5)}`}
          />
          <Info label="Travel radius" value={`${worker.travelRadiusKm} km`} />
          {worker.distanceKm != null && (
            <Info label="Task distance" value={`${worker.distanceKm.toFixed(2)} km`} />
          )}
        </section>

        <section className="panel">
          <h3>Eligibility checklist</h3>
          <div className="check-list">
            {checkEntries.map(([key, passed]) => (
              <div className={`check-row ${passed === true ? 'pass' : passed === false ? 'fail' : 'neutral'}`} key={key}>
                {passed === true
                  ? <CircleCheck size={18} />
                  : passed === false
                    ? <CircleAlert size={18} />
                    : <span className="check-na">—</span>}
                <span>{CHECK_LABELS[key] || key}</span>
              </div>
            ))}
          </div>
        </section>
      </div>

      <div className="panel-grid availability-panels">
        <section className="panel">
          <h3>Capabilities</h3>
          <Info label="Enrollment type" value={(worker.enrollmentTypes || []).join(', ') || '-'} />
          <Info label="Categories" value={(worker.professionalCategories || []).join(', ') || 'General helper'} />
          <Info label="Worker status" value={worker.workerStatus || '-'} />
          <Info label="KYC status" value={worker.kycStatus || '-'} />
        </section>
        <section className="panel">
          <h3>{worker.activeJob ? 'Active assignment' : 'Readiness explanation'}</h3>
          {worker.activeJob ? (
            <div className="active-job-card">
              <BriefcaseBusiness size={22} />
              <div>
                <strong>{worker.activeJob.title || worker.activeJob.category}</strong>
                <span>{worker.activeJob.status.replace('_', ' ')}</span>
                <code>{worker.activeJob.customerTaskId}</code>
              </div>
            </div>
          ) : worker.reasons.length ? (
            <ul className="reason-list">
              {worker.reasons.map((reason) => <li key={reason}>{reason}</li>)}
            </ul>
          ) : (
            <div className="ready-callout">
              <CircleCheck size={22} />
              Worker can receive {taskSpecific ? 'this simulated task' : 'matching nearby tasks'}.
            </div>
          )}
        </section>
      </div>
    </section>
  );
}

function AccountDeletion() {
  return (
    <main className="policy-page">
      <article className="policy">
        <p className="policy-kicker">Gofer Worker</p>
        <h1>Account And Data Deletion</h1>
        <p className="policy-updated">Last updated: July 1, 2026</p>

        <p>
          Gofer Worker users can request deletion of their worker account and associated
          personal data by contacting Gofer support.
        </p>

        <h2>How To Request Deletion</h2>
        <ol>
          <li>
            Send an email to{' '}
            <a href="mailto:sabyasachinishant100@gmail.com">sabyasachinishant100@gmail.com</a>.
          </li>
          <li>Use the subject line: Gofer Worker account deletion request.</li>
          <li>Include the phone number used in the Gofer Worker app.</li>
          <li>
            We may ask for additional verification to confirm that the request is coming from
            the account owner.
          </li>
        </ol>

        <h2>Data Deleted</h2>
        <p>After a valid deletion request, we will delete or anonymize eligible account data, including:</p>
        <ul>
          <li>Worker profile details such as name, phone number, city, work area, and worker type.</li>
          <li>Uploaded identity document images and selfie images where deletion is legally permitted.</li>
          <li>Worker enrollment and verification records where deletion is legally permitted.</li>
        </ul>

        <h2>Data We May Keep</h2>
        <p>
          Some information may be retained when necessary for fraud prevention, customer safety,
          legal compliance, dispute resolution, audit logs, security records, or regulatory
          obligations. Retained data will be kept only for as long as needed for those purposes.
        </p>

        <h2>Processing Time</h2>
        <p>
          We aim to process valid deletion requests within 30 days. If more time is required due
          to verification, legal, security, or technical reasons, we will inform the requester
          where possible.
        </p>

        <h2>Contact</h2>
        <p>
          For deletion, correction, or privacy questions, contact:{' '}
          <a href="mailto:sabyasachinishant100@gmail.com">sabyasachinishant100@gmail.com</a>
        </p>
      </article>
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

function Metric({ label, value, tone = '' }) {
  return (
    <div className={`metric ${tone}`}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function PresenceDot({ status }) {
  return <span className={`presence-dot ${status}`} aria-hidden="true" />;
}

function AvailabilityBadge({ status, large = false }) {
  const labels = {
    ready: 'Ready',
    busy: 'Busy',
    offline: 'Offline',
    stale: 'Stale',
    notification_unavailable: 'No notifications',
    location_unavailable: 'No location',
    online_not_eligible: 'Not eligible',
    not_verified: 'Not verified',
  };
  return (
    <span className={`availability-badge ${large ? 'large' : ''} ${status}`}>
      {status === 'ready' ? <CircleCheck size={14} /> :
        status === 'offline' ? <WifiOff size={14} /> :
          status === 'notification_unavailable' ? <Bell size={14} /> :
            <CircleAlert size={14} />}
      {labels[status] || status}
    </span>
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

function formatRelative(value) {
  if (!value) return 'never';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 10) return 'just now';
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatDuration(value) {
  if (!value) return '-';
  const seconds = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return 'for less than a minute';
  if (seconds < 3600) return `for ${Math.floor(seconds / 60)} minutes`;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `for ${hours}h ${minutes}m`;
}

function formatAge(seconds) {
  if (seconds == null) return '-';
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
}

createRoot(document.getElementById('root')).render(<App />);
