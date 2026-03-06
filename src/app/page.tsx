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

  // --- FITUR SOUND ---
  const playNotification = () => {
    const audio = new Audio('/notification.mp3'); 
    audio.play().catch(() => console.log("Audio blocked. Tap anywhere!"));
  };

  useEffect(() => {
    const fetchVisitors = async () => {
      // Pastikan order jam_masuk descending agar terbaru di atas
      const { data } = await supabase.from('visitors').select('*').order('jam_masuk', { ascending: false });
      if (data) setVisitors(data);
    };
    fetchVisitors();

    const channel = supabase.channel('realtime-final-v2')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'visitors' }, (payload: any) => {
        if (payload.eventType === 'INSERT') {
          // Tambah ke paling atas array
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
    } else {
      alert("Error: " + error.message);
    }
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
    <main onClick={() => setIsAudioReady(true)} className="min-h-screen bg-[#F1F5F9] p-4 md:p-12 font-sans text-slate-900 selection:bg-blue-600">
      
      {/* POPUP: Menggunakan z-index tinggi agar tidak menutupi form saat registrasi */}
      {showSuccessPopup && (
        <div className="fixed inset-0 flex items-center justify-center z-[200] px-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"></div>
          <div className="bg-white p-8 md:p-10 rounded-[2.5rem] shadow-2xl border border-white text-center relative z-[201] max-w-sm w-full animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-xl shadow-blue-100">
              <svg className="text-white" width="30" height="30" fill="none" stroke="currentColor" strokeWidth="4" viewBox="0 0 24 24"><path d="M20 6 9 17l-5-5"/></svg>
            </div>
            <h3 className="text-xl font-black uppercase tracking-tighter italic">Berhasil Terdaftar!</h3>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 md:gap-12">
        
        {/* FORM REGISTRASI (Kiri Desktop, Atas Mobile) */}
        <section className="lg:col-span-1 order-1">
          <div className="bg-white p-6 md:p-10 rounded-[2.5rem] md:rounded-[3rem] shadow-2xl border border-white lg:sticky lg:top-12">
            <div className="mb-8 text-center lg:text-left">
              <div className="inline-block px-4 py-1.5 bg-slate-900 text-white rounded-full text-[8px] font-black uppercase tracking-[0.2em] mb-4 italic">Reception Desk</div>
              <h2 className="text-2xl md:text-4xl font-black text-slate-900 tracking-tighter leading-tight uppercase italic">Buku <span className="text-blue-600 not-italic">Tamu</span></h2>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
              <input name="nama" required className="w-full px-6 py-4 md:py-5 rounded-2xl md:rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all font-bold text-slate-700" placeholder="Nama Lengkap" />
              <input name="instansi" className="w-full px-6 py-4 md:py-5 rounded-2xl md:rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all font-bold text-slate-700" placeholder="Instansi/Perusahaan" />
              <textarea name="keperluan" rows={3} className="w-full px-6 py-4 md:py-5 rounded-2xl md:rounded-[1.8rem] bg-slate-50 border-2 border-transparent focus:border-blue-600 outline-none transition-all resize-none font-bold text-sm text-slate-700" placeholder="Keperluan Kunjungan"></textarea>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-5 md:py-6 rounded-2xl md:rounded-[1.8rem] font-black uppercase tracking-[0.2em] text-[10px] md:text-[11px] hover:bg-slate-900 transition-all shadow-xl italic active:scale-95">
                {loading ? "MENGIRIM..." : "DAFTAR SEKARANG"}
              </button>
            </form>
          </div>
        </section>

        {/* LOG TAMU (Kanan Desktop, Bawah Mobile) */}
        <section className="lg:col-span-2 order-2">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-6 gap-4 px-2">
            <div>
              <h1 className="text-3xl md:text-6xl font-black text-slate-900 tracking-tight uppercase italic">Log <span className="text-blue-600 not-italic">Hadir</span></h1>
              <div className="flex items-center gap-2 bg-white px-3 py-1 rounded-full border border-slate-100 shadow-sm w-fit mt-2">
                <span className="relative flex h-2 w-2"><span className="animate-ping absolute h-full w-full rounded-full bg-green-400 opacity-75"></span><span className="h-2 w-2 rounded-full bg-green-500"></span></span>
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest italic">Live Monitor</span>
              </div>
            </div>
            <input type="text" placeholder="Cari Nama..." className="w-full md:w-64 px-6 py-3 bg-white rounded-2xl text-xs font-black shadow-lg outline-none focus:ring-2 focus:ring-blue-600 uppercase" onChange={(e) => setSearchTerm(e.target.value)} />
          </div>

          {/* TABLE FOR DESKTOP, CARDS FOR MOBILE */}
          <div className="bg-white rounded-[2.5rem] md:rounded-[4.5rem] shadow-2xl border border-white overflow-hidden">
            {/* Desktop Table Hidden on Small Screens */}
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full text-left min-w-[850px]">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    <th className="px-8 py-8 text-[9px] font-black uppercase text-slate-400 tracking-widest">Waktu</th>
                    <th className="px-8 py-8 text-[9px] font-black uppercase text-slate-400 tracking-widest">Status</th>
                    <th className="px-8 py-8 text-[9px] font-black uppercase text-slate-400 tracking-widest">Pengunjung</th>
                    <th className="px-8 py-8 text-[9px] font-black uppercase text-slate-400 tracking-widest">Keperluan</th>
                    {isAdmin && <th className="px-8 py-8 text-[9px] font-black uppercase text-slate-400 text-right tracking-widest">Opsi</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredVisitors.map((v) => (
                    <tr key={v.id} className={`transition-all duration-300 ${v.status === 'waiting' ? 'bg-red-50/20' : v.jam_keluar ? 'opacity-50' : ''}`}>
                      <td className="px-8 py-8 font-black text-xs tabular-nums text-slate-800">
                        {new Date(v.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="px-8 py-8">
                        {v.status === 'waiting' ? (
                          <span className="text-[8px] font-black text-red-600 uppercase italic animate-pulse">WAITING</span>
                        ) : (
                          <span className="text-[8px] font-black text-green-500 uppercase italic">ACCEPTED</span>
                        )}
                      </td>
                      <td className="px-8 py-8">
                        <div className="text-base font-black text-slate-900 uppercase">{v.nama}</div>
                        <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">{v.instansi || 'Mandiri'}</div>
                      </td>
                      <td className="px-8 py-8 text-[10px] font-bold text-slate-400 italic line-clamp-1">"{v.keperluan || '-'}"</td>
                      {isAdmin && (
                        <td className="px-8 py-8 text-right flex justify-end gap-2">
                          {v.status === 'waiting' && <button onClick={() => handleAcc(v.id)} className="px-3 py-1.5 bg-green-500 text-white text-[8px] font-black rounded-lg uppercase">Verify</button>}
                          {v.status === 'done' && !v.jam_keluar && <button onClick={() => handleCheckout(v.id)} className="px-3 py-1.5 bg-blue-500 text-white text-[8px] font-black rounded-lg uppercase">Out</button>}
                          <button onClick={() => setDeleteConfirm({show: true, id: v.id})} className="p-1.5 text-slate-200 hover:text-red-500"><svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2.5" viewBox="0 0 24 24"><path d="M3 6h18m-2 0v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6m3 0V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg></button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Card Layout Hidden on Desktop */}
            <div className="md:hidden divide-y divide-slate-50">
              {filteredVisitors.map((v) => (
                <div key={v.id} className={`p-6 ${v.status === 'waiting' ? 'bg-red-50/10' : ''}`}>
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-[10px] font-black text-slate-400 tabular-nums">
                      {new Date(v.jam_masuk).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {v.status === 'waiting' ? (
                       <span className="text-[8px] font-black text-red-600 uppercase italic px-2 py-0.5 bg-red-100 rounded-full">WAITING</span>
                    ) : (
                       <span className="text-[8px] font-black text-green-500 uppercase italic px-2 py-0.5 bg-green-100 rounded-full">ACCEPTED</span>
                    )}
                  </div>
                  <div className="text-lg font-black text-slate-900 uppercase leading-none mb-1">{v.nama}</div>
                  <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">{v.instansi || 'MANDIRI'}</div>
                  <div className="text-[11px] font-medium text-slate-500 bg-slate-50 p-3 rounded-xl italic mb-4">"{v.keperluan || '-'}"</div>
                  
                  {isAdmin && (
                    <div className="flex gap-2">
                       {v.status === 'waiting' && <button onClick={() => handleAcc(v.id)} className="flex-1 bg-green-500 text-white py-2 text-[9px] font-black rounded-lg uppercase">Verify</button>}
                       {v.status === 'done' && !v.jam_keluar && <button onClick={() => handleCheckout(v.id)} className="flex-1 bg-blue-500 text-white py-2 text-[9px] font-black rounded-lg uppercase">Check-out</button>}
                       <button onClick={() => setDeleteConfirm({show: true, id: v.id})} className="px-4 bg-slate-100 text-slate-400 rounded-lg">X</button>
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
    <Suspense fallback={<div className="min-h-screen bg-slate-100 flex items-center justify-center font-black text-slate-300 text-4xl italic tracking-tighter">LOADING...</div>}>
      <VisitorContent />
    </Suspense>
  );
}
