# 📜 قواعد وإرشادات المشروع - Fire Bank Bot (GEMINI.md)

هذا الملف يحتوي على القواعد، المعايير، والتعليمات الأساسية لتطوير وإدارة بوت **Fire Bank** الخاص بـ Discord.

---

## 🛠️ تقنيات المشروع (Tech Stack)
- **اللغة الأساسية:** TypeScript (v5+)
- **المكتبة الرئيسية:** `discord.js` (v14+)
- **المنفذ والتشغيل:** Node.js مع `tsx` للتشغيل المباشر (`npm run dev`)
- **إدارة البيئة:** `dotenv` لقراءة `.env`

---

## 📁 هيكلية وتنسيق المشروع (Project Structure)
- **`src/main.ts`**: الملف الرئيسي لتشغيل البوت، تسجيل الأوامر (Slash Commands & Text Commands)، ومعالجة الأحداث (Events & Collectors).
- **`src/cooldownManager.ts`**: مدير وقت التبريد (Cooldown Manager) لضبط أوقات الانتظار بين الأوامر.
- **`src/openRouter.ts`**: خدمة الذكاء الاصطناعي والمحادثات المباشرة.
- **`src/emojiManager.ts`**: مدير الأيموجيات التفاعلية.
- **`allowed_channels.json`**: قائمة الرومات المسموح فيها بعمل البوت.
- **`market_prices.json`**: أسعار الأسهم والأصول المالية.

---

## ⚙️ قواعد وقوانين التطوير (Development Rules)

### 1️⃣ الأوامر والوظائف الجديدة (Commands & Features)
- **الشمولية:** أي أمر جديد يتم إنشاؤه يجب دعمه عبر الرسائل النصية (Text Messages) و Slash Commands في آن واحد.
- **التبريد (Cooldowns):** يجب ربط كل أمر في خريطة التبريد `COMMAND_COOLDOWNS` في `src/cooldownManager.ts` (مثل أمر `عجلة`: 4 دقائق).
- **إدارة الأموال:** عمليات الخصم والإضافة تتم دائماً على `profile.wallet` أو `profile.bank` باستخدام `getUserProfile(userId)`.

### 2️⃣ التنسيق والشكل البصري (UI/UX Guidelines)
- استخدام الـ **Embeds** والأزرار التفاعلية (**ActionRowBuilder**, **ButtonBuilder**).
- الحفاظ على الهوية البصرية لبوت Fire Bank والرموز التعبيرية العربية بشكل افتراضي.
- عدم تعديل أو إلغاء الأوامر المستقرة السابقة عند إضافة أوامر جديدة.

### 3️⃣ قواعد السلامة والتشغيل (Safety & Server Execution)
- تشغيل البوت دائمًا عبر `npm run dev`.
- التعامل مع تعارض منافذ HTTP (EADDRINUSE) لضمان عدم توقف البوت.
