/*
  Achados e Conectados
  Para sincronizar celulares e computadores, configure o Firebase conforme README.md.
  Sem configuração, o site funciona em modo de demonstração neste navegador.
*/
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, collection, addDoc, getDocs, query, orderBy, serverTimestamp, doc, updateDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { getStorage, ref, uploadBytes, getDownloadURL, deleteObject } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

const firebaseConfig = {
  apiKey: "COLOQUE_SUA_API_KEY",
  authDomain: "COLOQUE_SEU_PROJETO.firebaseapp.com",
  projectId: "COLOQUE_SEU_PROJETO",
  storageBucket: "COLOQUE_SEU_PROJETO.appspot.com",
  messagingSenderId: "COLOQUE_SEU_SENDER_ID",
  appId: "COLOQUE_SEU_APP_ID"
};

const configured = !Object.values(firebaseConfig).some(v => String(v).startsWith("COLOQUE_"));
let app, auth, db, storage;

if (configured) {
  app = initializeApp(firebaseConfig);
  auth = getAuth(app);
  db = getFirestore(app);
  storage = getStorage(app);
}

const $ = id => document.getElementById(id);
const views = ["homeView","studentView","directorLoginView","directorView"];
let currentUser = null;
let demo = { submissions: [], published: [], claims: [] };
let toastTimer;

function toast(message) {
  const el = $("toast");
  el.textContent = message;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 3200);
}

function showView(id) {
  views.forEach(v => $(v).classList.toggle("hidden", v !== id));
  $("backButton").classList.toggle("hidden", id === "homeView");
  window.scrollTo({top:0,behavior:"smooth"});
}

function escapeHtml(s="") {
  return String(s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}

function safeDate(v) {
  try {
    return v?.toDate ? v.toDate().toLocaleString("pt-BR") : (v ? new Date(v).toLocaleString("pt-BR") : "Agora");
  } catch {
    return "Agora";
  }
}

function isDemo() {
  return !configured;
}

function readDemo() {
  try {
    demo = JSON.parse(localStorage.getItem("ac-demo-data") || '{"submissions":[],"published":[],"claims":[]}');
  } catch {}
}

function saveDemo() {
  localStorage.setItem("ac-demo-data", JSON.stringify(demo));
}

function newId() {
  return "demo-" + Date.now() + "-" + Math.random().toString(36).slice(2,7);
}

$("homeButton").addEventListener("click", () => showView("homeView"));
$("backButton").addEventListener("click", () => showView("homeView"));

$("studentChoice").addEventListener("click", () => {
  showView("studentView");
  loadGallery();
});

$("directorChoice").addEventListener("click", () => {
  if (currentUser) {
    showView("directorView");
    loadDirector();
  } else {
    showView("directorLoginView");
  }
});

document.querySelectorAll(".tab").forEach(btn => btn.addEventListener("click", () => {
  const parent = btn.closest(".view");
  parent.querySelectorAll(".tab").forEach(t => t.classList.toggle("active", t === btn));
  parent.querySelectorAll(".tab-panel").forEach(p => p.classList.toggle("hidden", p.id !== btn.dataset.tab));
}));

$("foundPhoto").addEventListener("change", () => {
  const file = $("foundPhoto").files[0];
  const box = $("photoPreview");

  if (!file) {
    box.classList.add("hidden");
    box.innerHTML = "";
    return;
  }

  if (!file.type.startsWith("image/")) {
    $("foundPhoto").value = "";
    toast("Escolha um arquivo de imagem.");
    return;
  }

  if (file.size > 5*1024*1024) {
    $("foundPhoto").value = "";
    toast("A foto precisa ter menos de 5 MB.");
    return;
  }

  box.innerHTML = `<img alt="Prévia da foto" src="${URL.createObjectURL(file)}">`;
  box.classList.remove("hidden");
});

async function uploadImage(file, path) {
  if (isDemo()) return await fileToDataUrl(file);

  const imageRef = ref(storage, path);
  await uploadBytes(imageRef, file, {contentType:file.type});
  return await getDownloadURL(imageRef);
}

function fileToDataUrl(file) {
  return new Promise((resolve,reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

$("foundForm").addEventListener("submit", async e => {
  e.preventDefault();

  const file = $("foundPhoto").files[0];
  if (!file) return toast("Adicione uma foto do objeto.");

  const submit = e.submitter;
  submit.disabled = true;
  submit.textContent = "Enviando...";

  try {
    const id = newId();
    const imageUrl = await uploadImage(file, `objects/${id}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`);

    const item = {
      id,
      description: $("foundDescription").value.trim(),
      place: $("foundPlace").value.trim(),
      imageUrl,
      status: "pending",
      createdAt: isDemo() ? new Date().toISOString() : serverTimestamp()
    };

    if (isDemo()) {
      demo.submissions.unshift(item);
      saveDemo();
    } else {
      await addDoc(collection(db,"submissions"), item);
    }

    $("foundForm").reset();
    $("photoPreview").classList.add("hidden");
    $("photoPreview").innerHTML = "";
    toast("Objeto enviado! A direção poderá analisar o registro.");
  } catch (err) {
    console.error(err);
    toast("Não foi possível enviar. Confira a configuração e tente novamente.");
  } finally {
    submit.disabled = false;
    submit.textContent = "Enviar para a direção";
  }
});

async function getPublished() {
  if (isDemo()) return demo.published;

  const q = query(collection(db,"items"), orderBy("createdAt","desc"));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({...d.data(), id:d.id}));
}

function itemCard(item, mode) {
  const actions = mode === "student"
    ? `<div class="item-actions"><button class="claim" data-claim="${escapeHtml(item.id)}">Este é meu</button></div>`
    : mode === "pending"
      ? `<div class="item-actions"><button class="approve" data-approve="${escapeHtml(item.id)}">Publicar</button><button class="reject" data-reject="${escapeHtml(item.id)}">Recusar</button></div>`
      : `<div class="item-actions"><button class="delete" data-delete="${escapeHtml(item.id)}">Marcar como devolvido / remover</button></div>`;

  return `<article class="item-card"><img src="${item.imageUrl}" alt="Foto do objeto" loading="lazy"><div class="item-content"><h3>${escapeHtml(item.description || "Objeto encontrado")}</h3><p>📍 ${escapeHtml(item.place || "Local não informado")}</p><p>Enviado: ${escapeHtml(safeDate(item.createdAt))}</p>${actions}</div></article>`;
}

function bindItemActions(root) {
  root.querySelectorAll("[data-claim]").forEach(b => b.addEventListener("click", () => openClaim(b.dataset.claim)));
  root.querySelectorAll("[data-approve]").forEach(b => b.addEventListener("click", () => approveItem(b.dataset.approve)));
  root.querySelectorAll("[data-reject]").forEach(b => b.addEventListener("click", () => rejectItem(b.dataset.reject)));
  root.querySelectorAll("[data-delete]").forEach(b => b.addEventListener("click", () => removeItem(b.dataset.delete)));
}

async function loadGallery() {
  const root = $("publicGallery");
  root.innerHTML = `<div class="empty-state">Carregando objetos...</div>`;

  try {
    const items = await getPublished();
    root.innerHTML = items.length
      ? items.map(i => itemCard(i,"student")).join("")
      : `<div class="empty-state">Ainda não há objetos publicados. Volte mais tarde.</div>`;

    bindItemActions(root);
  } catch (err) {
    console.error(err);
    root.innerHTML = `<div class="empty-state">Não foi possível carregar o mural. Verifique a configuração do Firebase.</div>`;
  }
}

$("refreshGallery").addEventListener("click", loadGallery);

function openClaim(id) {
  $("claimItemId").value = id;
  const item = [...demo.published].find(i => i.id === id);
  $("claimItemName").textContent = item ? item.description : "Preencha os dados para a direção conferir.";
  $("claimDialog").showModal();
}

$("closeClaim").addEventListener("click", () => $("claimDialog").close());

$("claimForm").addEventListener("submit", async e => {
  e.preventDefault();

  const itemId = $("claimItemId").value;
  const claim = {
    id: newId(),
    itemId,
    studentName: $("claimStudentName").value.trim(),
    proof: $("claimProof").value.trim(),
    status: "new",
    createdAt: isDemo() ? new Date().toISOString() : serverTimestamp()
  };

  try {
    if (isDemo()) {
      demo.claims.unshift(claim);
      saveDemo();
    } else {
      await addDoc(collection(db,"claims"), claim);
    }

    $("claimDialog").close();
    $("claimForm").reset();
    toast("Solicitação enviada à direção.");
  } catch (err) {
    console.error(err);
    toast("Não foi possível enviar a solicitação.");
  }
});

async function getPending() {
  if (isDemo()) return demo.submissions;

  const snap = await getDocs(query(collection(db,"submissions"), orderBy("createdAt","desc")));
  return snap.docs.map(d => ({...d.data(), id:d.id}));
}

async function loadDirector() {
  try {
    const [pending, published, claims] = await Promise.all([getPending(), getPublished(), getClaims()]);

    $("pendingCount").textContent = pending.length;
    $("claimsCount").textContent = claims.filter(c => c.status === "new").length;

    $("pendingList").innerHTML = pending.length
      ? pending.map(i => itemCard(i,"pending")).join("")
      : `<div class="empty-state">Nenhum envio aguardando análise.</div>`;

    $("directorPublishedList").innerHTML = published.length
      ? published.map(i => itemCard(i,"published")).join("")
      : `<div class="empty-state">Nenhum objeto publicado ainda.</div>`;

    $("claimsList").innerHTML = claims.length
      ? claims.map(claimCard).join("")
      : `<div class="empty-state">Nenhuma solicitação recebida.</div>`;

    bindItemActions($("pendingList"));
    bindItemActions($("directorPublishedList"));
    bindClaimActions();
  } catch (err) {
    console.error(err);
    $("pendingList").innerHTML = `<div class="empty-state">Não foi possível carregar os dados. Confira as regras e a configuração do Firebase.</div>`;
  }
}

async function getClaims() {
  if (isDemo()) return demo.claims;

  const snap = await getDocs(query(collection(db,"claims"), orderBy("createdAt","desc")));
  return snap.docs.map(d => ({...d.data(), id:d.id}));
}

function claimCard(c) {
  return `<article class="claim-card"><span class="status ${c.status==="reviewed"?"done":""}">${c.status==="new"?"NOVA SOLICITAÇÃO":"ANALISADA"}</span><h3>${escapeHtml(c.studentName)}</h3><p><strong>Objeto:</strong> ${escapeHtml(c.itemDescription || c.itemId)}</p><p><strong>Informação privada para conferência:</strong> ${escapeHtml(c.proof)}</p><p><strong>Enviada:</strong> ${escapeHtml(safeDate(c.createdAt))}</p><div class="item-actions"><button class="approve" data-reviewed="${escapeHtml(c.id)}">Marcar como analisada</button></div></article>`;
}

function bindClaimActions() {
  document.querySelectorAll("[data-reviewed]").forEach(b => b.addEventListener("click", async () => {
    const id = b.dataset.reviewed;

    try {
      if (isDemo()) {
        const c = demo.claims.find(x => x.id === id);
        if (c) c.status = "reviewed";
        saveDemo();
      } else {
        await updateDoc(doc(db,"claims",id), {status:"reviewed"});
      }

      await loadDirector();
      toast("Solicitação marcada como analisada.");
    } catch(e) {
      console.error(e);
      toast("Não foi possível atualizar a solicitação.");
    }
  }));
}

async function approveItem(id) {
  try {
    if (isDemo()) {
      const i = demo.submissions.find(x => x.id === id);
      if (!i) return;

      demo.submissions = demo.submissions.filter(x => x.id !== id);
      const {status, ...published} = i;
      demo.published.unshift(published);
      saveDemo();
    } else {
      const item = (await getPending()).find(x => x.id === id);
      if (!item) return;

      const {id:oldId, ...data} = item;
      await addDoc(collection(db,"items"), {...data, createdAt:serverTimestamp()});
      await deleteDoc(doc(db,"submissions",id));
    }

    await loadDirector();
    toast("Objeto publicado no mural!");
  } catch(e) {
    console.error(e);
    toast("Não foi possível publicar. Confira o Firebase.");
  }
}

async function rejectItem(id) {
  if (!confirm("Deseja recusar/remover este envio?")) return;

  try {
    if (isDemo()) {
      demo.submissions = demo.submissions.filter(x => x.id !== id);
      saveDemo();
    } else {
      await deleteDoc(doc(db,"submissions",id));
    }

    await loadDirector();
    toast("Envio removido.");
  } catch(e) {
    console.error(e);
    toast("Não foi possível remover.");
  }
}

async function removeItem(id) {
  if (!confirm("Remover este objeto do mural? Faça isso quando ele for devolvido ao dono.")) return;

  try {
    if (isDemo()) {
      demo.published = demo.published.filter(x => x.id !== id);
      saveDemo();
    } else {
      await deleteDoc(doc(db,"items",id));
    }

    await loadDirector();
    toast("Objeto removido do mural.");
  } catch(e) {
    console.error(e);
    toast("Não foi possível remover.");
  }
}

$("loginForm").addEventListener("submit", async e => {
  e.preventDefault();

  if (isDemo()) {
    toast("Modo demonstração: configure o Firebase para criar um acesso privado real.");
    return;
  }

  const btn = e.submitter;
  btn.disabled = true;
  btn.textContent = "Entrando...";

  try {
    const credential = await signInWithEmailAndPassword(
      auth,
      $("directorEmail").value.trim(),
      $("directorPassword").value
    );

    currentUser = credential.user;
    showView("directorView");
    await loadDirector();
  } catch(err) {
    console.error(err);
    toast("Acesso não autorizado. Confira e-mail e senha.");
  } finally {
    btn.disabled = false;
    btn.textContent = "Entrar";
  }
});

$("logoutButton").addEventListener("click", async () => {
  if (!isDemo() && auth) await signOut(auth);

  currentUser = null;
  showView("homeView");
  toast("Você saiu do painel.");
});

if (!isDemo()) {
  onAuthStateChanged(auth, user => {
    currentUser = user;
  });
} else {
  readDemo();

  // A demonstração usa o mesmo navegador e não sincroniza entre dispositivos.
  $("directorChoice").addEventListener("dblclick", () => {
    const answer = prompt("Modo de demonstração: digite DEMO para abrir o painel local.");

    if (answer === "DEMO") {
      showView("directorView");
      loadDirector();
    }
  });
                                                                        }
