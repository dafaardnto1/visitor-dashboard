"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';

function VisitorContent() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: string | null}>({show: false, id: null});
  
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get('admin') === 'true';

  // --- FITUR SOUND (FIXED FOR MOBILE SECURITY) ---
  const playNotification = () => {
    const audio = new Audio('/notification.mp3'); 
    // Menghilangkan Error Pop-up dengan .catch kosong atau console.log
    audio.play().catch((err) => {
      console.warn("Autoplay blocked: Browser requires user gesture first.");
    });
  };

  useEffect(() => {
    const fetchVisitors = async () => {
      const { data } = await supabase.from('visitors').select('*').order('jam_masuk', { ascending: false });
      if (data) setVisitors(data);
    };
    fetchVisitors();

    const channel = supabase.channel('realtime-mobile-fix')
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
    // Jika error karena security audio, kita abaikan agar proses tetap jalan
  }

  async function handleAcc(id: string) {
    await supabase.from('visitors').update({ status: 'done' }).eq('id', id);
  }

  async function handleCheckout(id: string) {
    await supabase.from('visitors').update({ jam_keluar: new Date().toISOString() }).eq('id', id);
  }

  async function confirmDelete() {
    if (deleteConfirm.id) {
      await supabase.from('visitors').delete().eq('id', deleteConfirm.id);
      setDeleteConfirm({show: false, id: null});
    }
  }

  return (
    <main 
      onClick={() => setIsAudioReady(true)} 
      className="min-h-screen bg-[#F1F5F9] p-4 md:p-12 font-sans text-slate-900 selection:bg-blue-600"
    >
      
      {/* POPUP: SUCCESS */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md animate-in fade-in"></div>
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-white text-center relative z-[201] max-w-sm w-full animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100">
              <svg className="text-white" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter italic">Check-in Success</h3>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION */}
      {deleteConfirm.show && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="bg-white p-10 rounded-[2.5rem] shadow-2xl border border-white text-center relative z-[201] max-w-sm w-full animate-in zoom-in duration-200">
            <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic text-red-600">Remove Entry?</h3>
            <div className="flex gap-3 mt-8">
              <button onClick={() => setDeleteConfirm({show: false, id: null})} className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest text-slate-400 italic">Cancel</button>
              <button onClick={confirmDelete} className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-red-600 text-white shadow-lg italic flex justify-center items-center">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        
        {/* LEFT: FORM (Order 1 on Mobile) */}
        <section className="lg:col-span-1 order-1">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-white lg:sticky lg:top-12">
            <div className="mb-10 text-center lg:text-left">
              <div className="inline-block px-5 py-2 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-[0.25em] mb-5 italic shadow-lg shadow-slate-200">Visitor Desk</div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter leading-tight uppercase italic">Visitor <span className="text-blue-600 not-italic font-black">Entry</span></h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input name="nama" required className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all font-bold text-slate-700 shadow-inner" placeholder="Full Name" />
              <input name="instansi" className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all font-bold text-slate-700 shadow-inner" placeholder="Affiliation" />
              <textarea name="keperluan" rows={3} className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all resize-none font-bold text-sm text-slate-700 shadow-inner" placeholder="Purpose of Visit"></textarea>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-6 rounded-[1.8rem] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-slate-900 transition-all shadow-xl shadow-blue-100 italic">
                {loading ? "PROCESSING..." : "REGISTER VISITOR"}
              </button>
            </form>
          </div>
        </section>

        {/* RIGHT: LOGS (Order 2 on Mobile) */}
        <section className="lg:col-span-2 order-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 px-4">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight uppercase italic">Arrival <span className="text-blue-600 not-italic font-black">Logs</span></h1>
              <div className="flex items-center gap-2 bg-white px-4 py-1.5 rounded-full border border-slate-100 shadow-sm w-fit">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                </span>
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] italic">Active Monitoring System</span>
              </div>
            </div>
            <div className="relative w-full md:w-72">
              <input type="text" placeholder="Search visitor..." className="w-full pl-14 pr-6 py-4 bg-white rounded-[1.5rem] text-xs font-black border-none shadow-xl shadow-slate-200/50 outline-none focus:ring-2 focus:ring-blue-600 transition-all uppercase tracking-widest placeholder:text-slate-300" onChange={(e) => setSearchTerm(e.target.value)} />
              <svg className="absolute left-6 top-4 text-slate-300" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="3" viewBox="0 0 24 24"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>
            </div>
          </div>

          <div className="bg-white rounded-[3rem] md:rounded-[4.5rem] shadow-2xl border border-white overflow-hidden">
            {/* Desktop Table View */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left min-w-[850px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Time / Status</th>
                    <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Checkout</th>
                    <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Profile</th>
                    <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Purpose</th>
                    {isAdmin && <th className="px-12 py-10 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Ops</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredVisitors.map((v) => (
                    <tr key={v.id} className={`group transition-all duration-300 ${v.status === 'waiting' ? 'bg-red-50/20' : v.jam_keluar ? 'opacity-60 grayscale-[0.5]' : ''}`}>
                      <td className="px-12 py-10">
                        <div className="text-sm font-black text-slate-800 tabular-nums mb-2 leading-none">{new Date(v.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                        {v.status === 'waiting' ? (
                          <div className="flex items-center gap-1.5 animate-pulse">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
                            </span>
                            <span className="text-[8px] font-black text-red-600 uppercase italic">WAITING</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5"><div className="h-2 w-2 rounded-full bg-green-500"></div><span className="text-[8px] font-black text-green-500 uppercase italic">ACCEPTED</span></div>
                        )}
                      </td>
                      <td className="px-12 py-10">
                        {v.jam_keluar ? <div className="text-xs font-black text-slate-500 tabular-nums bg-slate-100 px-3 py-1.5 rounded-lg w-fit">{new Date(v.jam_keluar).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div> : <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">On-site</span>}
                      </td>
                      <td className="px-12 py-10"><div className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-tight mb-1">{v.nama}</div><div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v.instansi || 'Independent'}</div></td>
                      <td className="px-12 py-10"><div className="text-[11px] font-bold text-slate-400 italic line-clamp-2 max-w-[200px]">"{v.keperluan || '-'}"</div></td>
                      {isAdmin && (
                        <td className="px-12 py-10 text-right flex justify-end gap-3 items-center min-h-[100px]">
                            {v.status === 'waiting' && <button onClick={() => handleAcc(v.id)} className="px-6 py-2.5 bg-green-500 text-white text-[9px] font-black uppercase rounded-2xl">Verify</button>}
                            {v.status === 'done' && !v.jam_keluar && <button onClick={() => handleCheckout(v.id)} className="px-6 py-2.5 bg-blue-500 text-white text-[9px] font-black uppercase rounded-2xl">Checkout</button>}
                            <button onClick={() => setDeleteConfirm({show: true, id: v.id})} className="p-3 text-slate-200 hover:text-red-500 transition-all hover:bg-red-50 rounded-xl"><svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-100">
              {filteredVisitors.map((v) => (
                <div key={v.id} className={`p-6 ${v.status === 'waiting' ? 'bg-red-50/10' : ''}`}>
                  <div className="flex justify-between items-start mb-3">
                    <div className="text-xs font-black text-slate-400">{new Date(v.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</div>
                    {v.status === 'waiting' ? (
                      <span className="text-[8px] font-black text-red-600 bg-red-100 px-2 py-1 rounded-full animate-pulse tracking-widest uppercase">WAITING</span>
                    ) : (
                      <span className="text-[8px] font-black text-green-600 bg-green-100 px-2 py-1 rounded-full tracking-widest uppercase">ACCEPTED</span>
                    )}
                  </div>
                  <div className="text-xl font-black text-slate-900 uppercase leading-none mb-1">{v.nama}</div>
                  <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">{v.instansi || 'INDEPENDENT'}</div>
                  <div className="bg-slate-50 p-4 rounded-2xl text-xs font-medium text-slate-500 italic mb-4">"{v.keperluan || '-'}"</div>
                  
                  {isAdmin && (
                    <div className="flex gap-2">
                       {v.status === 'waiting' && <button onClick={() => handleAcc(v.id)} className="flex-1 bg-green-500 text-white py-3 text-[10px] font-black rounded-xl uppercase shadow-lg shadow-green-100">Verify</button>}
                       {v.status === 'done' && !v.jam_keluar && <button onClick={() => handleCheckout(v.id)} className="flex-1 bg-blue-500 text-white py-3 text-[10px] font-black rounded-xl uppercase shadow-lg shadow-blue-100">Checkout</button>}
                       <button onClick={() => setDeleteConfirm({show: true, id: v.id})} className="w-12 bg-slate-100 flex items-center justify-center rounded-xl text-slate-400 font-bold">X</button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function VisitorDashboard() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center font-black text-slate-300 text-5xl italic tracking-tighter uppercase italic">BOOTING...</div>}>
      <VisitorContent />
    </Suspense>
  );
}
