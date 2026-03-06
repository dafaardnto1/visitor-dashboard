"use client";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '../lib/supabase';

function VisitorContent() {
  const [visitors, setVisitors] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(false);
  
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{show: boolean, id: string | null}>({show: false, id: null});
  
  const searchParams = useSearchParams();
  const isAdmin = searchParams.get('admin') === 'true';

  // --- SOLUSI SUARA: Pakai try-catch dan pastikan tidak menghambat kodingan lain ---
  const playNotification = () => {
    try {
      const audio = new Audio('/notification.mp3');
      audio.muted = false;
      const playPromise = audio.play();

      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Jika diblokir mobile, diam saja. Jangan lempar error ke sistem utama.
          console.log("Audio muted/blocked by mobile browser policy.");
        });
      }
    } catch (e) {
      // Abaikan jika ada error object audio
    }
  };

  useEffect(() => {
    const fetchVisitors = async () => {
      const { data } = await supabase.from('visitors').select('*').order('jam_masuk', { ascending: false });
      if (data) setVisitors(data);
    };
    fetchVisitors();

    const channel = supabase.channel('realtime-ultimate-fix')
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
    
    // Kirim data ke Supabase
    const { error } = await supabase.from('visitors').insert({
      nama: formData.get('nama'),
      instansi: formData.get('instansi'),
      keperluan: formData.get('keperluan'),
      status: 'waiting' 
    });
    
    if (error) {
      alert("Error: " + error.message);
      setLoading(false);
      return;
    }

    // Jika berhasil, reset form dan munculkan popup
    setLoading(false);
    (e.target as HTMLFormElement).reset();
    setShowSuccessPopup(true);
    setTimeout(() => setShowSuccessPopup(false), 2500);
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
    <main className="min-h-screen bg-[#F1F5F9] p-4 md:p-12 font-sans text-slate-900 overflow-x-hidden">
      
      {/* SUCCESS POPUP (Z-INDEX 200) */}
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
              <button onClick={confirmDelete} className="flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-widest bg-red-600 text-white shadow-lg italic">Delete</button>
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        
        {/* FORM REGISTRASI */}
        <section className="lg:col-span-1">
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-white lg:sticky lg:top-12">
            <div className="mb-8 text-center lg:text-left">
              <div className="inline-block px-5 py-2 bg-slate-900 text-white rounded-full text-[9px] font-black uppercase tracking-[0.25em] mb-5 italic shadow-lg">Visitor Desk</div>
              <h2 className="text-3xl md:text-4xl font-black text-slate-900 tracking-tighter leading-tight uppercase italic">Visitor <span className="text-blue-600 not-italic font-black">Entry</span></h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-6">
              <input name="nama" required className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all font-bold text-slate-700" placeholder="Full Name" />
              <input name="instansi" className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all font-bold text-slate-700" placeholder="Affiliation" />
              <textarea name="keperluan" rows={3} className="w-full px-7 py-5 rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all resize-none font-bold text-sm text-slate-700" placeholder="Purpose of Visit"></textarea>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-6 rounded-[1.8rem] font-black uppercase tracking-[0.3em] text-[11px] hover:bg-slate-900 transition-all shadow-xl italic">
                {loading ? "PROCESSING..." : "REGISTER VISITOR"}
              </button>
            </form>
          </div>
        </section>

        {/* LOGS SECTION */}
        <section className="lg:col-span-2 overflow-x-hidden">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-8 gap-6 px-4">
            <div className="space-y-2">
              <h1 className="text-4xl md:text-6xl font-black text-slate-900 tracking-tight uppercase italic italic">Arrival <span className="text-blue-600 not-italic">Logs</span></h1>
              <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-slate-100 shadow-sm w-fit">
                <span className="relative flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]"></span>
                </span>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic tracking-wider">Live System</span>
              </div>
            </div>
            <input type="text" placeholder="Search..." className="w-full md:w-64 px-6 py-4 bg-white rounded-2xl text-xs font-black shadow-xl outline-none focus:ring-2 focus:ring-blue-600 uppercase" onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          <div className="bg-white rounded-[3rem] shadow-2xl border border-white overflow-hidden">
            <div className="overflow-x-auto scrollbar-hide">
              <table className="w-full text-left min-w-[650px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Timestamp</th>
                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Visitor Profile</th>
                    <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">Purpose</th>
                    {isAdmin && <th className="px-8 py-8 text-[10px] font-black uppercase tracking-[0.3em] text-slate-400 text-right">Ops</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredVisitors.map((v) => (
                    <tr key={v.id} className={`transition-all duration-300 ${v.status === 'waiting' ? 'bg-red-50/20' : v.jam_keluar ? 'opacity-50 grayscale-[0.3]' : ''}`}>
                      <td className="px-8 py-10">
                        <div className="text-sm font-black text-slate-800 tabular-nums mb-2 leading-none">
                          {new Date(v.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                        {v.status === 'waiting' ? (
                          <div className="flex items-center gap-1.5 animate-pulse">
                            <span className="relative flex h-2 w-2">
                              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-600 shadow-[0_0_10px_rgba(239,68,68,0.8)]"></span>
                            </span>
                            <span className="text-[8px] font-black text-red-600 uppercase italic">WAITING</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5">
                            <div className="h-2 w-2 rounded-full bg-green-500"></div>
                            <span className="text-[8px] font-black text-green-500 uppercase italic">ACCEPTED</span>
                            {v.jam_keluar && <span className="text-[8px] font-black text-slate-400 uppercase ml-2 italic">— {new Date(v.jam_keluar).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>}
                          </div>
                        )}
                      </td>
                      <td className="px-8 py-10">
                        <div className="text-lg font-black text-slate-900 uppercase tracking-tighter leading-tight mb-1">{v.nama}</div>
                        <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{v.instansi || 'Independent'}</div>
                      </td>
                      <td className="px-8 py-10">
                        <div className="text-[11px] font-bold text-slate-400 italic line-clamp-2 max-w-[200px]">"{v.keperluan || '-'}"</div>
                      </td>
                      {isAdmin && (
                        <td className="px-8 py-10 text-right flex justify-end gap-3 items-center min-h-[100px]">
                            {v.status === 'waiting' && <button onClick={() => handleAcc(v.id)} className="px-5 py-2.5 bg-green-500 text-white text-[9px] font-black uppercase rounded-2xl italic">Verify</button>}
                            {v.status === 'done' && !v.jam_keluar && <button onClick={() => handleCheckout(v.id)} className="px-5 py-2.5 bg-blue-500 text-white text-[9px] font-black uppercase rounded-2xl italic">Checkout</button>}
                            <button onClick={() => setDeleteConfirm({show: true, id: v.id})} className="p-3 text-slate-200 hover:text-red-500 transition-all hover:bg-red-50 rounded-xl">
                              <svg width="20" height="20" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>
                            </button>
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
    <Suspense fallback={<div className="min-h-screen bg-slate-50 flex items-center justify-center font-black text-slate-200 text-5xl italic tracking-tighter italic">BOOTING...</div>}>
      <VisitorContent />
    </Suspense>
  );
}
