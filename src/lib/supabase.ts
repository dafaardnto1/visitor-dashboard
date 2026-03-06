"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';
import QRCode from 'react-qr-code'; // Import library QR

function VisitorContent() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [showQr, setShowQr] = useState(false); // State untuk tampilkan QR
  
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: string | null}>({show: false, id: null});
  
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get('admin') === 'true';

  const playNotification = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => console.log("Audio blocked by mobile policy"));
    } catch (e) {}
  };

  useEffect(() => {
    const fetchVisitors = async () => {
      const { data } = await supabase.from('visitors').select('*').order('jam_masuk', { ascending: false });
      if (data) setVisitors(data);
    };
    fetchVisitors();

    const channel = supabase.channel('realtime-final-qr')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          setVisitors((prev) => [payload.new, ...prev]);
          playNotification();
        } else if (payload.eventType === 'UPDATE') {
          setVisitors((prev) => prev.map(v => v.id === payload.new.id ? payload.new : v));
        } else if (payload.eventType === 'DELETE') {
          setVisitors((prev) => prev.filter((v) => v.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  const filteredVisitors = visitors.filter(v => 
    v.nama.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (v.instansi && v.instansi.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    const formData = new FormData(e.currentTarget);
    const { error } = await supabase.from('visitors').insert({
      nama: formData.get('nama'),
      instansi: formData.get('instansi'),
      keperluan: formData.get('keperluan'),
      status: 'waiting' 
    });
    setLoading(false);
    if (!error) {
      (e.target as HTMLFormElement).reset();
      setShowSuccessPopup(true);
      setTimeout(() => setShowSuccessPopup(false), 2500);
    }
  }

  async function handleAcc(id: string) {
    await supabase.from('visitors').update({ status: 'done' }).eq('id', id);
  }

  async function handleCheckout(id: string) {
    await supabase.from('visitors').update({ jam_keluar: new Date().toISOString() }).eq('id', id);
  }

  return (
    <main className="min-h-screen bg-[#F1F5F9] p-4 md:p-12 font-sans text-slate-900 overflow-x-hidden">
      
      {/* POPUP: SUCCESS */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="bg-white p-10 rounded-[3rem] shadow-2xl border border-white text-center relative z-[201] max-w-sm w-full">
            <h3 className="text-xl font-black uppercase tracking-tighter italic">Check-in Success</h3>
          </div>
        </div>
      )}

      {/* MODAL: QR CODE (Hanya muncul jika diaktifkan admin) */}
      {showQr && (
        <div className="fixed inset-0 flex items-center justify-center z-[250] px-4 animate-in fade-in">
          <div className="absolute inset-0 bg-slate-900/80 backdrop-blur-xl" onClick={() => setShowQr(false)}></div>
          <div className="bg-white p-8 md:p-12 rounded-[3.5rem] shadow-2xl text-center relative z-[251] max-w-sm w-full animate-in zoom-in duration-300">
            <div className="mb-6 text-[10px] font-black uppercase tracking-[0.3em] text-blue-600">Scan to Register</div>
            <div className="bg-white p-4 rounded-3xl border-8 border-slate-50 inline-block shadow-inner mb-6">
              <QRCode 
                value={window.location.origin} // Link otomatis ke domain Vercel kamu
                size={200}
                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                viewBox={`0 0 256 256`}
              />
            </div>
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.2em] mb-8">Scan QR ini menggunakan kamera HP untuk masuk ke form pendaftaran</p>
            <button onClick={() => setShowQr(false)} className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black uppercase text-[10px] tracking-widest italic">Close QR</button>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-white text-center relative z-[201] max-w-sm w-full">
            <h3 className="text-xl font-black uppercase tracking-tighter italic text-red-600">Remove Entry?</h3>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setDeleteConfirm({show: false, id: null})} className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400">Cancel</button>
              <button onClick={() => { supabase.from('visitors').delete().eq('id', deleteConfirm.id); setDeleteConfirm({show: false, id: null}); }} className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-red-600 text-white">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        <section className="lg:col-span-1">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white lg:sticky lg:top-12">
            <div className="mb-8 text-center lg:text-left">
              <div className="inline-block px-5 py-2 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-[0.25em] mb-5 italic shadow-lg">Visitor Desk</div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter leading-tight uppercase italic italic">Visitor <span className="text-blue-600 not-italic">Entry</span></h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input name="nama" required className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all font-bold text-slate-700 shadow-inner" placeholder="Full Name" />
              <input name="instansi" className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all font-bold text-slate-700 shadow-inner" placeholder="Affiliation" />
              <textarea name="keperluan" rows={3} className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all resize-none font-bold text-sm text-slate-700 shadow-inner" placeholder="Purpose of Visit"></textarea>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-6 rounded-[1.8rem] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-slate-900 transition-all shadow-xl italic uppercase tracking-widest">Register Visitor</button>
            </form>
          </div>
        </section>

        <section className="lg:col-span-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 px-4">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight uppercase italic italic">Arrival <span className="text-blue-600 not-italic">Logs</span></h1>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm w-fit">
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                  </span>
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic tracking-wider">Live System</span>
                </div>
                {/* TOMBOL QR (HANYA UNTUK ADMIN) */}
                {isAdmin && (
                  <button onClick={() => setShowQr(true)} className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg shadow-blue-100 hover:bg-slate-900 transition-all animate-bounce">
                    <span className="text-[10px] font-black uppercase tracking-widest italic">Show QR</span>
                  </button>
                )}
              </div>
            </div>
            <input type="text" placeholder="Search..." className="w-full md:w-64 px-6 py-4 bg-white rounded-2xl text-xs font-black shadow-xl outline-none focus:ring-2 focus:ring-blue-600 uppercase" onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="bg-white rounded-[3rem] shadow-2xl border border-white overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Time</th>
                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Profile</th>
                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredVisitors.map((v) => (
                    <tr key={v.id} className={`transition-all duration-300 ${v.status === 'waiting' ? 'bg-red-50/20' : v.jam_keluar ? 'opacity-50 grayscale-[0.3]' : ''}`}>
                      <td className="px-8 py-10">
                        <div className="text-sm font-black text-slate-800 tabular-nums leading-none mb-2">{new Date(v.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                        {v.status === 'waiting' ? (
                          <div className="flex items-center gap-1.5 animate-pulse"><span className="h-2 w-2 rounded-full bg-red-600"></span><span className="text-[8px] font-black text-red-600 uppercase italic">WAITING</span></div>
                        ) : (
                          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-green-500"></div><span className="text-[8px] font-black text-green-500 uppercase italic">ACCEPTED</span></div>
                        )}
                      </td>
                      <td className="px-8 py-10">
                        <div className="text-lg font-black text-slate-900 uppercase leading-none mb-1">{v.nama}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v.instansi || 'Independent'}</div>
                      </td>
                      {isAdmin && (
                        <td className="px-8 py-10 text-right flex justify-end gap-3 items-center min-h-[100px]">
                            {v.status === 'waiting' && <button onClick={() => handleAcc(v.id)} className="px-5 py-2.5 bg-green-500 text-white text-[9px] font-black uppercase rounded-2xl italic">Verify</button>}
                            {v.status === 'done' && !v.jam_keluar && <button onClick={() => handleCheckout(v.id)} className="px-5 py-2.5 bg-blue-500 text-white text-[9px] font-black uppercase rounded-2xl italic">Checkout</button>}
                            <button onClick={() => setDeleteConfirm({show: true, id: v.id})} className="p-3 text-slate-200 hover:text-red-500 transition-all hover:bg-red-50 rounded-xl">X</button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function VisitorDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center font-black text-slate-200 text-5xl italic tracking-tighter">BOOTING...</div>}>
      <VisitorContent />
    </Suspense>
  );
}