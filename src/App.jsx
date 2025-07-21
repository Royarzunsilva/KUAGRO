import React, { useState, useEffect, useMemo } from 'react';
import {
  Edit,
  Download,
  AlertTriangle,
  LogIn,
  Database,
  Palette,
  Calendar,
  Grid,
  List,
  ArrowLeft,
  Layers,
  Loader
} from 'lucide-react';
import { initializeApp } from 'firebase/app';
import { getAuth, signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { getFirestore, doc, setDoc, onSnapshot } from 'firebase/firestore';

const firebaseConfigString = typeof __firebase_config !== 'undefined' ? __firebase_config : '{}';
let firebaseConfig = {};
let app;
let db;
let auth;

try {
  firebaseConfig = JSON.parse(firebaseConfigString);
  if (firebaseConfig.apiKey) {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
  }
} catch (e) {
  console.error('Could not initialize Firebase. Invalid configuration.', e);
}

const appId = typeof __app_id !== 'undefined' ? __app_id : 'kua-agro-app';
const DATA_COLLECTION = `artifacts/${appId}/public/data/kua-data`;

const KuaOfficialLogo = () => (
  <svg viewBox="0 0 150 100" className="w-full h-auto">
    <rect width="150" height="100" fill="#000000" />
    <g transform="translate(15, 20)">
      <path d="M20 10 V 50" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <path d="M20 30 L 45 10" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <path d="M20 30 L 45 50" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
      <path d="M55 10 V 35 C 55 50, 85 50, 85 35 V 10" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" fill="none" />
      <polygon points="95,50 110,10 125,50" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" fill="none" />
      <line x1="102" y1="35" x2="118" y2="35" stroke="#FFFFFF" strokeWidth="6" strokeLinecap="round" />
    </g>
    <text x="75" y="85" fontFamily="sans-serif" fontSize="6" fill="#FFFFFF" textAnchor="middle" letterSpacing="0.5">
      AGROPECUARIA KUA FRUITS ZOMAC S.A.S.
    </text>
  </svg>
);

const KuaOfficialSymbol = ({ className }) => (
  <svg
    viewBox="0 0 40 40"
    className={className}
    fill="none"
    stroke="#FFFFFF"
    strokeWidth="5"
    strokeLinecap="round"
  >
    <path d="M10 5 V 35" />
    <path d="M10 20 L 30 5" />
    <path d="M10 20 L 30 35" />
  </svg>
);

const getWeekNumber = (d) => {
  d = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
};

export default function App() {
  const [agricultorNumber, setAgricultorNumber] = useState(null);
  const [activeTab, setActiveTab] = useState('Formulario de datos');
  const [currentView, setCurrentView] = useState('form');
  const [currentWeek, setCurrentWeek] = useState(getWeekNumber(new Date()));
  const [isWeekOverridden, setIsWeekOverridden] = useState(false);
  const [formData, setFormData] = useState({
    lote: 'Lote 1',
    color: 'Blanco',
    prematuro: '',
    presente: '',
    novedades: '',
    cosecha: ''
  });
  const [records, setRecords] = useState([]);
  const [isAuthReady, setIsAuthReady] = useState(false);

  useEffect(() => {
    if (!auth) return;
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setIsAuthReady(true);
      } else {
        signInAnonymously(auth).catch((error) => {
          console.error('Anonymous sign-in failed:', error);
        });
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!db || !agricultorNumber || !isAuthReady) return;

    const docRef = doc(db, DATA_COLLECTION, agricultorNumber);
    const unsub = onSnapshot(docRef, (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setRecords(data.records || []);
      } else {
        setRecords([]);
      }
    });
    return () => unsub();
  }, [agricultorNumber, isAuthReady]);

  const calculatedFields = useMemo(() => {
    const presente = parseFloat(formData.presente) || 0;
    const novedades = parseFloat(formData.novedades) || 0;
    const cosecha = parseFloat(formData.cosecha) || 0;
    const embolse = presente + novedades;
    const faltante = embolse - cosecha;
    return { embolse, faltante };
  }, [formData]);

  const handleLogin = (code) => {
    setAgricultorNumber(code.trim().toUpperCase());
  };

  const handleAddRecord = async () => {
    if (!db || !agricultorNumber || !isAuthReady) return;
    const newRecord = {
      id: Date.now(),
      week: currentWeek,
      agricultor: agricultorNumber,
      ...formData,
      ...calculatedFields
    };
    const updatedRecords = [newRecord, ...records];
    await setDoc(doc(db, DATA_COLLECTION, agricultorNumber), {
      records: updatedRecords
    });
    setFormData((prev) => ({
      ...prev,
      lote: formData.lote,
      color: formData.color,
      prematuro: '',
      presente: '',
      novedades: '',
      cosecha: ''
    }));
    setCurrentView('data');
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    if (name !== 'color' && name !== 'lote' && !/^\d*\.?\d*$/.test(value)) return;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleWeekChange = (e) => {
    setCurrentWeek(e.target.value);
    setIsWeekOverridden(true);
  };

  const resetToCurrentWeek = () => {
    setCurrentWeek(getWeekNumber(new Date()));
    setIsWeekOverridden(false);
  };

  const exportToExcel = () => {
    const headers = [
      'Semana',
      'Agricultor',
      'Lote',
      'Color de la Cinta',
      'Prematuro',
      'Presente',
      'Novedades',
      'Cosecha',
      'Embolse (calculado)',
      'Faltante (calculado)'
    ];
    const csvRows = [
      headers.join(','),
      ...records.map((r) =>
        [
          r.week,
          r.agricultor,
          r.lote,
          r.color,
          r.prematuro,
          r.presente,
          r.novedades,
          r.cosecha,
          r.embolse,
          r.faltante
        ].join(',')
      )
    ];
    const csvString = csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `Kua_AgroApp_Export_${new Date().toISOString().split('T')[0]}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (!agricultorNumber) {
    return <LoginScreen onLogin={handleLogin} isAuthReady={isAuthReady} />;
  }

  return (
    <div className="bg-gray-100 min-h-screen font-sans flex flex-col">
      <header className="bg-[#3A4F41] text-white shadow-md p-4 flex justify-between items-center">
        <div className="flex items-center gap-3">
          <KuaOfficialSymbol className="w-8 h-8" />
          <h1 className="text-xl font-bold">Kua AgroApp</h1>
        </div>
        <div className="text-right">
          <p className="text-sm">
            Cód. Agricultor: <span className="font-semibold">{agricultorNumber}</span>
          </p>
        </div>
      </header>

      <main className="flex-grow p-4 pb-24">
        {activeTab === 'Formulario de datos' &&
          (currentView === 'form' ? (
            <MainForm
              formData={formData}
              calculatedFields={calculatedFields}
              handleInputChange={handleInputChange}
              currentWeek={currentWeek}
              handleWeekChange={handleWeekChange}
              isWeekOverridden={isWeekOverridden}
              resetToCurrentWeek={resetToCurrentWeek}
              handleAddRecord={handleAddRecord}
              showDataView={() => setCurrentView('data')}
              recordCount={records.length}
            />
          ) : (
            <DataView
              records={records}
              exportToExcel={exportToExcel}
              showForm={() => setCurrentView('form')}
            />
          ))}
        {activeTab === 'Semana' && <PlaceholderTab icon={Calendar} title="Gestión de Semanas" />}
        {activeTab === 'Color' && <PlaceholderTab icon={Palette} title="Gestión de Colores" />}
      </main>

      <BottomNav
        activeTab={activeTab}
        setActiveTab={(tab) => {
          setActiveTab(tab);
          setCurrentView('form');
        }}
      />
    </div>
  );
}

const LoginScreen = ({ onLogin, isAuthReady }) => {
  const [agricultorCodeInput, setAgricultorCodeInput] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!agricultorCodeInput) {
      setError('Por favor, ingrese su código de agricultor.');
      return;
    }
    setError('');
    onLogin(agricultorCodeInput);
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-200 p-4">
      <div className="w-full max-w-md m-4 bg-white rounded-2xl shadow-2xl p-8">
        <div className="mb-8 w-3/5 mx-auto">
          <KuaOfficialLogo />
        </div>
        {!db && (
          <div className="p-4 mb-4 text-sm text-red-800 rounded-lg bg-red-50" role="alert">
            <span className="font-medium">Error de Configuración:</span> No se pudo conectar a la base de datos.
          </div>
        )}

        {!isAuthReady ? (
          <div className="flex justify-center items-center p-6">
            <Loader className="animate-spin text-gray-500" />
            <p className="ml-4 text-gray-600">Conectando al servidor...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="agricultor_code" className="block text-sm font-medium text-gray-700 mb-1">
                Tu Código de Agricultor
              </label>
              <input
                id="agricultor_code"
                type="text"
                value={agricultorCodeInput}
                onChange={(e) => setAgricultorCodeInput(e.target.value)}
                placeholder="Ingresa tu código"
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:ring-[#B0B89D] focus:border-[#B0B89D] transition"
              />
            </div>
            <button
              type="submit"
              disabled={!db}
              className="w-full mt-4 bg-[#3A4F41] text-white py-4 text-xl font-bold rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-4 focus:ring-[#B0B89D] transition-transform transform hover:scale-105 flex items-center justify-center disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              <LogIn className="mr-2" /> Ingresar
            </button>
          </form>
        )}
        {error && <p className="text-red-500 text-sm mt-2 text-center">{error}</p>}
      </div>
    </div>
  );
};

const MainForm = ({
  formData,
  calculatedFields,
  handleInputChange,
  currentWeek,
  handleWeekChange,
  isWeekOverridden,
  resetToCurrentWeek,
  handleAddRecord,
  showDataView,
  recordCount
}) => (
  <div className="space-y-6">
    <div className="flex justify-between items-center">
      <h2 className="text-2xl font-bold text-gray-800">Nuevo Registro</h2>
      {recordCount > 0 && (
        <button
          onClick={showDataView}
          className="bg-white text-[#3A4F41] px-4 py-2 text-lg font-bold rounded-lg border-2 border-[#3A4F41] hover:bg-gray-50 flex items-center"
        >
          <List size={20} className="mr-2" /> Ver {recordCount} Registros
        </button>
      )}
    </div>
    <WeekSelector
      currentWeek={currentWeek}
      handleWeekChange={handleWeekChange}
      isWeekOverridden={isWeekOverridden}
      resetToCurrentWeek={resetToCurrentWeek}
    />
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <SelectField
        name="lote"
        label="Lote"
        icon={Layers}
        value={formData.lote}
        onChange={handleInputChange}
        options={["Lote 1", "Lote 2", "Lote 3", "Lote 4"]}
      />
      <SelectField
        name="color"
        label="Color de la cinta"
        icon={Palette}
        value={formData.color}
        onChange={handleInputChange}
        options={[
          "Blanco",
          "Azul",
          "Dorado",
          "Gris",
          "Morado",
          "Café con Negro",
          "Naranja",
          "Verde",
          "Amarillo"
        ]}
      />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <InputField name="prematuro" label="Prematuro" value={formData.prematuro} onChange={handleInputChange} />
      <InputField name="presente" label="Presente" value={formData.presente} onChange={handleInputChange} />
      <InputField
        name="novedades"
        label="Novedades"
        value={formData.novedades}
        onChange={handleInputChange}
        description="Frutas dañadas, quemadas, rotas, etc."
      />
      <InputField name="cosecha" label="Cosecha" value={formData.cosecha} onChange={handleInputChange} />
    </div>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
      <CalculatedField label="Embolse (calculado)" value={calculatedFields.embolse} />
      <CalculatedField label="Faltante (calculado)" value={calculatedFields.faltante} isWarning={calculatedFields.faltante < 0} />
    </div>
    <button
      onClick={handleAddRecord}
      className="w-full bg-[#3A4F41] text-white py-4 text-xl font-bold rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-4 focus:ring-[#B0B89D] transition-transform transform hover:scale-105 shadow-lg"
    >
      Guardar Registro
    </button>
  </div>
);

const SelectField = ({ name, label, value, onChange, options, icon: Icon }) => (
  <div className="bg-white p-4 rounded-lg shadow">
    <label htmlFor={name} className="flex items-center text-sm font-medium text-gray-700">
      {Icon && <Icon className="w-4 h-4 mr-2 text-gray-400" />}
      {label}
    </label>
    <select
      id={name}
      name={name}
      value={value}
      onChange={onChange}
      className="w-full mt-1 px-3 py-2 text-2xl font-semibold border-b-2 border-gray-300 focus:outline-none focus:border-[#3A4F41] transition bg-white"
    >
      {options.map((opt) => (
        <option key={opt} value={opt}>
          {opt}
        </option>
      ))}
    </select>
  </div>
);

const WeekSelector = ({ currentWeek, handleWeekChange, isWeekOverridden, resetToCurrentWeek }) => (
  <div className="bg-white p-4 rounded-lg shadow">
    <label htmlFor="week-selector" className="block text-sm font-medium text-gray-700">
      Semana
    </label>
    <div className="flex items-center space-x-2 mt-1">
      <input
        id="week-selector"
        type="number"
        value={currentWeek}
        onChange={handleWeekChange}
        className="w-full px-3 py-2 text-lg border border-gray-300 rounded-md focus:ring-[#3A4F41] focus:border-[#3A4F41]"
      />
      {isWeekOverridden && (
        <button
          onClick={resetToCurrentWeek}
          className="p-2 bg-gray-200 rounded-md hover:bg-gray-300"
          title="Volver a la semana actual"
        >
          <Edit size={20} className="text-gray-600" />
        </button>
      )}
    </div>
    {!isWeekOverridden && <p className="text-xs text-gray-500 mt-1">Semana actual detectada automáticamente.</p>}
  </div>
);

const InputField = ({ name, label, value, onChange, description }) => (
  <div className="bg-white p-4 rounded-lg shadow">
    <label htmlFor={name} className="block text-sm font-medium text-gray-700">
      {label}
    </label>
    <input
      id={name}
      name={name}
      type="text"
      inputMode="decimal"
      value={value}
      onChange={onChange}
      placeholder="0"
      className="w-full mt-1 px-3 py-2 text-2xl font-semibold border-b-2 border-gray-300 focus:outline-none focus:border-[#3A4F41] transition"
    />
    {description && <p className="text-xs text-gray-500 mt-1">{description}</p>}
  </div>
);

const CalculatedField = ({ label, value, isWarning }) => (
  <div className={`p-4 rounded-lg shadow ${isWarning ? 'bg-red-100' : 'bg-stone-100'}`}>
    <label className={`block text-sm font-medium ${isWarning ? 'text-red-700' : 'text-gray-700'}`}>{label}</label>
    <div className="flex items-center mt-1">
      <p className={`text-2xl font-bold ${isWarning ? 'text-red-600' : 'text-gray-800'}`}>{value}</p>
      {isWarning && <AlertTriangle size={20} className="ml-2 text-red-600" />}
    </div>
  </div>
);

const DataView = ({ records, exportToExcel, showForm }) => (
  <div className="space-y-4">
    <div className="flex justify-between items-center flex-wrap gap-4">
      <button
        onClick={showForm}
        className="bg-gray-200 text-gray-800 px-4 py-2 text-lg font-bold rounded-lg hover:bg-gray-300 flex items-center"
      >
        <ArrowLeft size={20} className="mr-2" /> Volver
      </button>
      <button
        onClick={exportToExcel}
        disabled={records.length === 0}
        className="bg-[#3A4F41] text-white px-4 py-2 text-lg font-bold rounded-lg hover:bg-opacity-90 focus:outline-none focus:ring-4 focus:ring-[#B0B89D] transition disabled:bg-gray-400 disabled:cursor-not-allowed flex items-center"
      >
        <Download size={20} className="mr-2" /> Exportar
      </button>
    </div>

    {records.length === 0 ? (
      <div className="text-center py-10 bg-white rounded-lg shadow">
        <Database size={48} className="mx-auto text-gray-400" />
        <p className="mt-4 text-gray-600">No hay registros para mostrar.</p>
      </div>
    ) : (
      <div className="bg-white rounded-lg shadow overflow-x-auto">
        <table className="w-full min-w-max text-sm text-left text-gray-500">
          <thead className="text-xs text-gray-700 uppercase bg-stone-100">
            <tr>
              <th scope="col" className="px-4 py-3">
                Semana
              </th>
              <th scope="col" className="px-4 py-3">
                Lote
              </th>
              <th scope="col" className="px-4 py-3">
                Color Cinta
              </th>
              <th scope="col" className="px-4 py-3">
                Prematuro
              </th>
              <th scope="col" className="px-4 py-3">
                Presente
              </th>
              <th scope="col" className="px-4 py-3">
                Novedades
              </th>
              <th scope="col" className="px-4 py-3">
                Cosecha
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Embolse
              </th>
              <th scope="col" className="px-4 py-3 font-bold">
                Faltante
              </th>
            </tr>
          </thead>
          <tbody>
            {records.map((r) => (
              <tr key={r.id} className="bg-white border-b hover:bg-stone-50">
                <td className="px-4 py-3">{r.week}</td>
                <td className="px-4 py-3">{r.lote}</td>
                <td className="px-4 py-3">{r.color}</td>
                <td className="px-4 py-3">{r.prematuro}</td>
                <td className="px-4 py-3">{r.presente}</td>
                <td className="px-4 py-3">{r.novedades}</td>
                <td className="px-4 py-3">{r.cosecha}</td>
                <td className="px-4 py-3 font-semibold text-gray-800">{r.embolse}</td>
                <td className={`px-4 py-3 font-semibold ${r.faltante < 0 ? 'text-red-600' : 'text-gray-800'}`}>{r.faltante}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

const PlaceholderTab = ({ icon: Icon, title }) => (
  <div className="flex flex-col items-center justify-center h-full text-center py-16 bg-white rounded-lg shadow">
    <Icon size={64} className="text-gray-300" />
    <h2 className="mt-6 text-2xl font-semibold text-gray-700">{title}</h2>
    <p className="mt-2 text-gray-500">Esta funcionalidad está en desarrollo.</p>
  </div>
);

const BottomNav = ({ activeTab, setActiveTab }) => {
  const navItems = [
    { id: 'Semana', label: 'Semana', icon: Calendar },
    { id: 'Formulario de datos', label: 'Formulario', icon: Grid },
    { id: 'Color', label: 'Color', icon: Palette }
  ];
  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.1)] flex justify-around">
      {navItems.map(({ id, label, icon: Icon }) => (
        <button
          key={id}
          onClick={() => setActiveTab(id)}
          className={`flex flex-col items-center justify-center w-full pt-3 pb-2 text-sm transition-colors duration-200 ${
            activeTab === id ? 'text-[#3A4F41]' : 'text-gray-500 hover:text-[#3A4F41]'
          }`}
        >
          <Icon size={28} />
          <span className="mt-1 font-bold">{label}</span>
          {activeTab === id && <div className="w-12 h-1 bg-[#B0B89D] rounded-full mt-1"></div>}
        </button>
      ))}
    </nav>
  );
};
