# 🏗️ Raspored Gradilišta — Upute za postavljanje

## Što ćeš dobiti
Web aplikacija dostupna na linku poput:
**`https://raspored-gradilista.vercel.app`**

Svi inženjeri otvaraju isti link, prijave se PIN-om i vide isti raspored.

---

## Korak 1 — Instaliraj Node.js (jednom)
1. Idi na **https://nodejs.org**
2. Klikni veliki zeleni gumb "Download" (LTS verzija)
3. Instaliraj kao normalan program (Next → Next → Finish)

---

## Korak 2 — Napravi GitHub account (jednom)
1. Idi na **https://github.com**
2. Klikni "Sign up" — upiši email, lozinku, korisničko ime
3. Potvrdi email

---

## Korak 3 — Upload koda na GitHub
1. Prijavi se na GitHub
2. Klikni zeleni gumb **"New"** (lijevo gore)
3. Naziv repozitorija: `raspored-gradilista`
4. Ostavi sve na defaultu → klikni **"Create repository"**
5. Na stranici repozitorija klikni **"uploading an existing file"**
6. Povuci SVE fajlove iz ZIP-a (raspakiraj ga prvo!) u prozor
7. Klikni **"Commit changes"**

---

## Korak 4 — Deploy na Vercel (hosting)
1. Idi na **https://vercel.com**
2. Klikni **"Sign up"** → odaberi **"Continue with GitHub"**
3. Odobri pristup
4. Klikni **"Add New Project"**
5. Pronađi `raspored-gradilista` u listi → klikni **"Import"**
6. Sve ostavi na defaultu → klikni **"Deploy"**
7. Pričekaj ~2 minute

✅ Gotovo! Vercel ti daje link — nešto poput:
**`https://raspored-gradilista-abc123.vercel.app`**

---

## Korak 5 — Pošalji link inženjerima
Pošalji link WhatsAppom ili emailom.

**PINovi za prijavu:**
| Ime       | PIN  | Admin? |
|-----------|------|--------|
| Tomislav  | 1001 | —      |
| Tihomir   | 1002 | —      |
| Silvije   | 1003 | —      |
| Igor      | 1004 | —      |
| Antonio   | 1005 | —      |
| Damir     | 1006 | ✅ Admin (može mijenjati prošle dane) |
| Tin       | 1007 | ✅ Admin (može mijenjati prošle dane) |

---

## Napomena o pohrani podataka
Ova verzija koristi **localStorage** — svaki uređaj sprema podatke lokalno.
To znači da su podaci vidljivi samo na uređaju gdje su uneseni.

### Za pravo dijeljenje između uređaja (preporučeno za tim):
Treba se dodati **Supabase** baza podataka.
Javi se i pomožem ti s tim korakom kada budeš spreman.

---

## Promjena PINova ili dodavanje inženjera
Otvori fajl `src/App.jsx` u bilo kojem tekst editoru (npr. Notepad).
Pronađi ovaj dio (oko linije 50):

```javascript
const ENGINEERS = [
  { name: "Tomislav", pin: "1001" },
  ...
];
```

Promijeni po želji, spremi, i ponovi Korak 3 (upload na GitHub) —
Vercel automatski redeploya za ~1 minutu.

---

## Problemi?
Javi se — sve riješimo zajedno.
