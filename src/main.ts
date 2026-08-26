import "dotenv/config";
import fs from "fs";
import path from "path";
import http from "http";
import {
  Client,
  GatewayIntentBits,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  EmbedBuilder,
  ComponentType,
  Message,
  ButtonBuilder,
  ButtonStyle,
  Partials,
  Locale,
  ChatInputCommandInteraction,
} from "discord.js";
import { cooldownManager } from "./cooldownManager";
import { openRouterService } from "./openRouter";
import { syncAllGuildEmojis, ensureGuildEmojis } from "./emojiManager";

// --- LANGUAGE CONFIGURATION ---
const LANGUAGE_FILE = path.join(__dirname, "../language.json");
function loadLanguage(): string {
  try {
    if (fs.existsSync(LANGUAGE_FILE)) {
      const data = fs.readFileSync(LANGUAGE_FILE, "utf-8");
      const parsed = JSON.parse(data);
      return parsed.language || "ar";
    }
  } catch (err) {
    console.error("Failed to load language:", err);
  }
  return "ar";
}
function saveLanguage(lang: string) {
  try {
    fs.writeFileSync(LANGUAGE_FILE, JSON.stringify({ language: lang }, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save language:", err);
  }
}
let botLanguage = loadLanguage();
// --- END LANGUAGE CONFIGURATION ---



interface UserProfile {
  wallet: number;
  bank: number;
  shieldUntil?: number;
  inventory: {
    [key: string]: number;
    land: number;
    stock: number;
    car: number;
    plane: number;
    phone: number;
    train: number;
    stadium: number;
    company: number;
    robots: number;
    island: number;
    house: number;
    ship: number;
    program: number;
  };
}

interface MarketItem {
  id: string;
  name: string;
  nameEn: string;
  emoji: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  maxInventory: number;
  currentPrice: number;
  lastPrice: number;
}

const token = process.env.DISCORD_BOT_TOKEN?.trim().replace(/^["']|["']$/g, "");
if (!token) {
  throw new Error("DISCORD_BOT_TOKEN is missing in environment variables");
}
const CONFIG_FILE = path.join(__dirname, "../allowed_channels.json");
function loadAllowedChannels(): string[] {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, "utf-8");
      return JSON.parse(data);
    }
  } catch (err) {
    console.error("Failed to load allowed channels:", err);
  }
  return [];
}
loadAllowedChannels;
function saveAllowedChannels(channels: string[]) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(channels, null, 2), "utf-8");
  } catch (err) {
    console.error("Failed to save allowed channels:", err);
  }
}
saveAllowedChannels;
let allowedChannels = loadAllowedChannels();
const userProfiles = new Map();
function getUserProfile(userId: string): UserProfile {
  if (!userProfiles.has(userId)) {
    userProfiles.set(userId, {
      wallet: 0,
      bank: 0,
      shieldUntil: 0,
      inventory: {
        land: 0,
        stock: 0,
        car: 0,
        plane: 0,
        phone: 0,
        train: 0,
        stadium: 0,
        company: 0,
        robots: 0,
        island: 0,
        house: 0,
        ship: 0,
        program: 0,
      },
    });
  }
  return userProfiles.get(userId);
}
getUserProfile;
const activeSessions = new Set<string>();
const activeGames = new Set<string>();
const COMMAND_KEY_MAP: Record<string, string> = {
  "عجلة": "wheel",
  "عجله": "wheel",
  "wheel": "wheel",
  "عاجل": "wheel",
  "ajil": "wheel",
  "خبر عاجل": "wheel",
  "استثمار": "invest",
  "invest": "invest",
  "شراء": "buy",
  "buy": "buy",
  "بيع": "sell",
  "sell": "sell",
  "ايموجي": "emoji",
  "emoji": "emoji",
  "تداول": "trade",
  "trade": "trade",
  "الراتب": "salary",
  "salary": "salary",
  "تحدي": "challenge",
  "challenge": "challenge",
  "رياضيات": "math",
  "math": "math",
  "زر": "button",
  "button": "button",
  "لغز": "riddle",
  "riddle": "riddle",
  "لعبه": "game",
  "لعبة": "game",
  "نهب": "robbery",
  "robbery": "robbery",
  "حماية": "shield",
  "shield": "shield",
  "ممتلكات": "assets",
  "assets": "assets",
  "أسعار": "prices",
  "اسعار": "prices",
  "سوق": "prices",
  "متجر": "prices",
  "استفسار": "prices",
  "prices": "prices",
  "توب": "top",
  "top": "top",
  "توب الاثرياء": "top",
  "توب الأثرياء": "top",
};

async function checkCooldown(
  userId: string,
  commandName: string,
  target: any
): Promise<boolean> {
  const key = COMMAND_KEY_MAP[commandName] || commandName;
  const canProceed = await cooldownManager.checkAndHandle(key, userId, target);
  if (canProceed) {
    cooldownManager.set(key, userId);
  }
  return canProceed;
}
const marketItems: MarketItem[] = [
  {
    id: "land",
    name: "أراضي",
    nameEn: "Lands",
    emoji: "🏙️",
    basePrice: 435000,
    minPrice: 170000,
    maxPrice: 700000,
    maxInventory: 100,
    currentPrice: 435000,
    lastPrice: 435000,
  },
  {
    id: "stock",
    name: "أسهم",
    nameEn: "Stocks",
    emoji: "📊",
    basePrice: 65000,
    minPrice: 30000,
    maxPrice: 100000,
    maxInventory: 150,
    currentPrice: 65000,
    lastPrice: 65000,
  },
  {
    id: "car",
    name: "سيارات",
    nameEn: "Cars",
    emoji: "🚗",
    basePrice: 115000,
    minPrice: 60000,
    maxPrice: 170000,
    maxInventory: 95,
    currentPrice: 115000,
    lastPrice: 115000,
  },
  {
    id: "plane",
    name: "طائرات",
    nameEn: "Planes",
    emoji: "✈️",
    basePrice: 246968,
    minPrice: 95761,
    maxPrice: 398176,
    maxInventory: 100,
    currentPrice: 246968,
    lastPrice: 246968,
  },
  {
    id: "phone",
    name: "هواتف",
    nameEn: "Phones",
    emoji: "📱",
    basePrice: 46109,
    minPrice: 15837,
    maxPrice: 76381,
    maxInventory: 50,
    currentPrice: 46109,
    lastPrice: 46109,
  },
  {
    id: "train",
    name: "قطارات",
    nameEn: "Trains",
    emoji: "🚄",
    basePrice: 1035000,
    minPrice: 570000,
    maxPrice: 1500000,
    maxInventory: 100,
    currentPrice: 1035000,
    lastPrice: 1035000,
  },
  {
    id: "stadium",
    name: "ملاعب",
    nameEn: "Stadiums",
    emoji: "🏟️",
    basePrice: 7000000,
    minPrice: 1000000,
    maxPrice: 7000000,
    maxInventory: 10,
    currentPrice: 7000000,
    lastPrice: 7000000,
  },
  {
    id: "company",
    name: "شركات",
    nameEn: "Companies",
    emoji: "🏢",
    basePrice: 3000000,
    minPrice: 1000000,
    maxPrice: 5000000,
    maxInventory: 4,
    currentPrice: 3000000,
    lastPrice: 3000000,
  },
  {
    id: "robots",
    name: "روبوتات",
    nameEn: "Robots",
    emoji: "🤖",
    basePrice: 40000,
    minPrice: 30000,
    maxPrice: 50000,
    maxInventory: 55,
    currentPrice: 40000,
    lastPrice: 40000,
  },
  {
    id: "island",
    name: "جزر",
    nameEn: "Islands",
    emoji: "🏝️",
    basePrice: 3000000,
    minPrice: 1000000,
    maxPrice: 5000000,
    maxInventory: 1,
    currentPrice: 3000000,
    lastPrice: 3000000,
  },
  {
    id: "house",
    name: "بيوت",
    nameEn: "Houses",
    emoji: "🏠",
    basePrice: 750000,
    minPrice: 500000,
    maxPrice: 1000000,
    maxInventory: 20,
    currentPrice: 750000,
    lastPrice: 750000,
  },
  {
    id: "ship",
    name: "سفن",
    nameEn: "Ships",
    emoji: "🚢",
    basePrice: 600000,
    minPrice: 200000,
    maxPrice: 1000000,
    maxInventory: 100,
    currentPrice: 600000,
    lastPrice: 600000,
  },
  {
    id: "program",
    name: "برامج",
    nameEn: "Programs",
    emoji: "💻",
    basePrice: 40000,
    minPrice: 30000,
    maxPrice: 50000,
    maxInventory: 100,
    currentPrice: 40000,
    lastPrice: 40000,
  },
];
const MARKET_FILE = path.join(__dirname, "../market_prices.json");
let lastUpdateTimestamp = Date.now();
const UPDATE_INTERVAL = 300000;
function loadMarketPrices() {
  try {
    if (fs.existsSync(MARKET_FILE)) {
      const data = fs.readFileSync(MARKET_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (parsed.طابع_آخر_تحديث) {
        lastUpdateTimestamp = parsed.طابع_آخر_تحديث;
      }
      if (parsed.الأسعار) {
        for (const item of marketItems) {
          if (parsed.الأسعار[item.id]) {
            let loadedCurrent = parsed.الأسعار[item.id].السعر_الحالي;
            let loadedLast = parsed.الأسعار[item.id].السعر_السابق;
            if (loadedCurrent < item.minPrice || loadedCurrent > item.maxPrice) {
              loadedCurrent = item.basePrice;
            }
            if (loadedLast < item.minPrice || loadedLast > item.maxPrice) {
              loadedLast = item.basePrice;
            }
            item.currentPrice = loadedCurrent;
            item.lastPrice = loadedLast;
          }
        }
      }
      console.log("📦 Loaded market prices from disk.");
    }
  } catch (err) {
    console.error("Failed to load market prices:", err);
  }
}
loadMarketPrices;
function saveMarketPrices() {
  try {
    const dataToSave = {
      طابع_آخر_تحديث: lastUpdateTimestamp,
      الأسعار: marketItems.reduce((acc: any, item) => {
        acc[item.id] = {
          السعر_الحالي: item.currentPrice,
          السعر_السابق: item.lastPrice,
        };
        return acc;
      }, {}),
    };
    fs.writeFileSync(MARKET_FILE, JSON.stringify(dataToSave, null, 2), "utf-8");
    console.log("💾 Saved market prices to disk.");
  } catch (err) {
    console.error("Failed to save market prices:", err);
  }
}
saveMarketPrices;
function updateMarketPrices() {
  for (const item of marketItems) {
    item.lastPrice = item.currentPrice;

    // 50% Upward (+1.5% to +8.5%), 50% Downward (-1.5% to -8.5%)
    const isUpward = Math.random() < 0.5;
    const changePercent = (Math.random() * 7 + 1.5) / 100;

    if (isUpward) {
      let newPrice = Math.round(item.currentPrice * (1 + changePercent));
      if (newPrice === item.currentPrice) newPrice += 1;
      if (newPrice > item.maxPrice) newPrice = item.maxPrice;
      item.currentPrice = newPrice;
    } else {
      let newPrice = Math.round(item.currentPrice * (1 - changePercent));
      if (newPrice === item.currentPrice) newPrice -= 1;
      if (newPrice < item.minPrice) newPrice = item.minPrice;
      item.currentPrice = newPrice;
    }
  }
  lastUpdateTimestamp = Date.now();
  saveMarketPrices();
  console.log("🔄 Market prices dynamically and randomly updated!");
}
updateMarketPrices;
function initMarket() {
  loadMarketPrices();
  console.log("⏰ Updating market prices immediately to refresh trend states...");
  updateMarketPrices();
}
initMarket;
initMarket();
setInterval(() => {
  const now = Date.now();
  if (now - lastUpdateTimestamp >= UPDATE_INTERVAL) {
    updateMarketPrices();
  }
}, 30000);
function getTrendEmoji(item: MarketItem, guild: any): string {
  const diff = item.currentPrice - item.lastPrice;
  const upwardEmoji =
    guild?.emojis?.cache?.find((e: any) => e.name === "upward") ||
    client.emojis.cache.find((e: any) => e.name === "upward");
  const downwardEmoji =
    guild?.emojis?.cache?.find((e: any) => e.name === "downward") ||
    client.emojis.cache.find((e: any) => e.name === "downward");
  const neutralEmoji =
    guild?.emojis?.cache?.find((e: any) => e.name === "neutral~1" || e.name === "neutral") ||
    client.emojis.cache.find((e: any) => e.name === "neutral~1" || e.name === "neutral");

  if (diff > 0) return upwardEmoji ? upwardEmoji.toString() : "🔺";
  if (diff < 0) return downwardEmoji ? downwardEmoji.toString() : "🔻";
  return neutralEmoji ? neutralEmoji.toString() : "▶️";
}
getTrendEmoji;
function getNextUpdateRemainingStr(): string {
  const now = Date.now();
  const nextUpdate = lastUpdateTimestamp + UPDATE_INTERVAL;
  const remainingMs = Math.max(0, nextUpdate - now);
  const totalSeconds = remainingMs / 1e3;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = Math.floor(totalSeconds % 60);
  const tenths = Math.floor((remainingMs % 1e3) / 100);
  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}
getNextUpdateRemainingStr;
function getMarketEmbed(
  guild: any,
  authorName?: string,
  authorAvatarUrl?: string,
  lang: string = botLanguage,
): EmbedBuilder {
  const thumbnail =
    guild?.iconURL({ size: 256 }) ||
    client.user?.displayAvatarURL({ size: 256 }) ||
    null;
  const remainingStr = getNextUpdateRemainingStr();
  const isEn = lang === "en";
  const titleText = isEn ? `| **Prices**` : `| **الاسعار**`;
  const timerText = isEn
    ? `| **Prices will update after :** \`${remainingStr}\``
    : `| **سيتم تحديث الاسعار بعد :** \`${remainingStr}\``;

  const embed = new EmbedBuilder()
    .setColor(2829617)
    .setDescription(
      [
        titleText,
        ``,
        timerText,
        `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
      ].join("\n"),
    )
    .setTimestamp();
  if (authorName && authorAvatarUrl) {
    embed.setAuthor({ name: authorName, iconURL: authorAvatarUrl });
  }
  if (thumbnail) {
    embed.setThumbnail(thumbnail);
  }
  for (const item of marketItems) {
    const trend = getTrendEmoji(item, guild);
    const itemName = isEn ? item.nameEn : item.name;
    embed.addFields({
      name: `${itemName} :${item.emoji}`,
      value: `${trend} \`${item.currentPrice.toLocaleString("en-US")} $\``,
      inline: true,
    });
  }
  return embed;
}
getMarketEmbed;
function getAiContextString(userId: string): string {
  const profile = getUserProfile(userId);
  const remainingStr = getNextUpdateRemainingStr();
  const marketInfo = marketItems
    .map((item) => {
      const diff = item.currentPrice - item.lastPrice;
      const trend = diff > 0 ? "مرتفع" : diff < 0 ? "منخفض" : "ثابت";
      return `- ${item.emoji} ${item.name} (${item.nameEn}): السعر الحالي ${item.currentPrice.toLocaleString()} $، السعر السابق ${item.lastPrice.toLocaleString()} $، الاتجاه ${trend}، الحدود ${item.minPrice.toLocaleString()} $ - ${item.maxPrice.toLocaleString()} $`;
    })
    .join("\n");
  const inventoryInfo = marketItems
    .map((item) => {
      const quantity = profile.inventory[item.id] || 0;
      const value = quantity * item.currentPrice;
      return `- ${item.emoji} ${item.name}: ${quantity}/${item.maxInventory}، القيمة الحالية ${value.toLocaleString()} $`;
    })
    .join("\n");
  const totalInventoryValue = marketItems.reduce((sum, item) => {
    const quantity = profile.inventory[item.id] || 0;
    return sum + quantity * item.currentPrice;
  }, 0);
  const totalNetWorth = profile.wallet + profile.bank + totalInventoryValue;
  const profileInfo = [
    `👛 رصيد المحفظة: ${profile.wallet.toLocaleString()} $`,
    `🏦 رصيد البنك: ${profile.bank.toLocaleString()} $`,
    `📦 قيمة الممتلكات: ${totalInventoryValue.toLocaleString()} $`,
    `💰 إجمالي الثروة: ${totalNetWorth.toLocaleString()} $`,
  ].join("\n");
  return `البيانات اللحظية الحالية للبوت:

[سوق السلع الحالي]:
${marketInfo}

[الوقت المتبقي لتحديث الأسعار]:
\`${remainingStr}\`

[بيانات العميل المالية]:
${profileInfo}

[مخزون العميل]:
${inventoryInfo}`;
}

function getTop10Users() {
  const usersWithWealth: Array<{ userId: string; wealth: number }> = [];

  for (const [userId, profile] of userProfiles.entries()) {
    let totalInventoryValue = 0;
    for (const item of marketItems) {
      const qty = profile.inventory[item.id] || 0;
      if (qty > 0) {
        totalInventoryValue += qty * item.currentPrice;
      }
    }
    const wealth = (profile.wallet || 0) + (profile.bank || 0) + totalInventoryValue;
    usersWithWealth.push({ userId, wealth });
  }

  usersWithWealth.sort((a, b) => b.wealth - a.wealth);
  return usersWithWealth.slice(0, 10);
}

function buildTopEmbed(
  authorUsername: string,
  authorAvatarUrl: string,
  guildIconUrl?: string | null
) {
  const topUsers = getTop10Users();
  const ranks = ["🥇", "🥈", "🥉", "4️⃣", "5️⃣", "6️⃣", "7️⃣", "8️⃣", "9️⃣", "🔟"];
  const lines: string[] = [];

  if (topUsers.length === 0) {
    lines.push("لا يوجد أعضاء في قائمة الأثرياء حالياً.");
  } else {
    for (let i = 0; i < topUsers.length; i++) {
      const user = topUsers[i];
      const rankEmoji = ranks[i] || `${i + 1}️⃣`;
      lines.push(`${rankEmoji} <@${user.userId}> • **ثروته:** \`${user.wealth.toLocaleString("en-US")} $\``);
    }
  }

  const embed = new EmbedBuilder()
    .setColor(2829617)
    .setAuthor({
      name: authorUsername,
      iconURL: authorAvatarUrl,
    })
    .setDescription([`| **توب الأثرياء**`, ``, ...lines].join("\n"))
    .setTimestamp();

  if (guildIconUrl) {
    embed.setThumbnail(guildIconUrl);
  }

  return embed;
}
getAiContextString;
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
  partials: [Partials.Channel],
});
client.once("ready", async () => {
  console.log(`✅ Fire Bank is online as ${client.user?.tag}`);
  await syncAllGuildEmojis(client);
  try {
    console.log("Publishing slash commands globally and to all connected guilds...");
    const allSlashCommands = [
      {
        name: "abb-channel",
        description: "تحديد الغرف التي يمكن للبوت العمل فيها (بحد أقصى 3 غرف)",
        options: [
          {
            name: "channel1",
            description: "الروم الأول المسموح به للعمليات البنكية",
            type: 7,
            channel_types: [0],
            required: true,
          },
          {
            name: "channel2",
            description: "الروم الثاني المسموح به للعمليات البنكية (اختياري)",
            type: 7,
            channel_types: [0],
            required: false,
          },
          {
            name: "channel3",
            description: "الروم الثالث المسموح به للعمليات البنكية (اختياري)",
            type: 7,
            channel_types: [0],
            required: false,
          },
        ],
      },
      {
        name: "cancel-room",
        description: "إلغاء تفعيل البوت في روم معين",
        options: [
          {
            name: "channel",
            description: "الروم المراد إلغاء تفعيل البوت فيه",
            type: 7,
            channel_types: [0],
            required: true,
          },
        ],
      },
      {
        name: "choose-language",
        description: "اختيار لغة حديث ومساعد البوت / Choose the bot language",
        options: [
          {
            name: "language",
            description: "اللغة المطلوبة / Target language",
            type: 3,
            required: true,
            choices: [
              { name: "العربية (Arabic)", value: "ar" },
              { name: "English", value: "en" },
            ],
          },
        ],
      },
      {
        name: "wheel",
        description: "عجلة الحظ في Fire Bank - أدر العجلة لربح الجوائز المالية!",
      },
      {
        name: "ajil",
        description: "عجلة الحظ في Fire Bank - أدر العجلة لربح الجوائز المالية!",
      },
      {
        name: "riddle",
        description: "بدء لعبة اللغز من الذكاء الاصطناعي للفوز بمكافأة خيالية",
      },
      {
        name: "math",
        description: "حل مسألة رياضية سريعة للفوز بمكافأة مالية",
      },
      {
        name: "emoji",
        description: "اختبار قوة الذاكرة وتخمين مكان الأيموجي الصحيح",
      },
      {
        name: "invest",
        description: "استثمار أموالك في الأسهم والشركات العالمية",
        options: [
          {
            name: "amount",
            description: "المبلغ المراد استثماره",
            type: 4,
            required: true,
          },
        ],
      },
      {
        name: "trade",
        description: "تداول العملات الرقمية بنسب أرباح وخسائر متغيره",
        options: [
          {
            name: "amount",
            description: "المبلغ المراد التداول به",
            type: 4,
            required: true,
          },
        ],
      },
      {
        name: "salary",
        description: "ترتيب الأرقام للحصول على راتبك الدوري",
      },
      {
        name: "buy",
        description: "شراء سلع أو أصول من السوق المالي",
        options: [
          {
            name: "quantity",
            description: "العدد المراد شراؤه",
            type: 4,
            required: true,
          },
        ],
      },
      {
        name: "sell",
        description: "بيع سلع أو أصول في السوق المالي",
        options: [
          {
            name: "quantity",
            description: "العدد المراد بيعه",
            type: 4,
            required: true,
          },
        ],
      },
      {
        name: "prices",
        description: "عرض أسعار السوق الحالية للسلع والأصول",
      },
      {
        name: "properties",
        description: "كشف حسابك المالي ورصيد محفظتك وممتلكاتك",
      },
      {
        name: "time",
        description: "عرض حالات وأوقات الانتظار لتبريد الأوامر",
      },
      {
        name: "top",
        description: "عرض قائمة أعلى 10 أثرياء في السيرفر",
      },
      {
        name: "add_money",
        description: "إضافة مبلغ مالي إلى محفظة عضو (بحد أقصى 1 تريليون $)",
        options: [
          {
            name: "user",
            description: "العضو المراد إضافة المبلغ له",
            type: 6,
            required: true,
          },
          {
            name: "money",
            description: "المبلغ المراد إضافته (بحد أقصى 1 تريليون $)",
            type: 10,
            min_value: 1,
            max_value: 1000000000000,
            required: true,
          },
        ],
      },
      {
        name: "got",
        description: "إضافة مبلغ مالي إلى محفظة عضو (بحد أقصى 1 تريليون $)",
        options: [
          {
            name: "user",
            description: "العضو المراد إضافة المبلغ له",
            type: 6,
            required: true,
          },
          {
            name: "money",
            description: "المبلغ المراد إضافته (بحد أقصى 1 تريليون $)",
            type: 10,
            min_value: 1,
            max_value: 1000000000000,
            required: true,
          },
        ],
      },
    ];

    await client.application?.commands.set(allSlashCommands);
    for (const [guildId, guild] of client.guilds.cache) {
      try {
        await guild.commands.set([]); // مسح التكرار الخاص بالسيرفر
      } catch (gErr) {}
    }
    console.log("✅ All slash commands published globally without duplicates!");
  } catch (err) {
    console.error("Error registering slash commands:", err);
  }
});
client.on("guildCreate", async (guild) => {
  await ensureGuildEmojis(guild);
});

interface WheelPrize {
  name: string;
  amount: number;
  weight: number;
  tier: "low" | "medium" | "high";
}

const WHEEL_PRIZES: WheelPrize[] = [
  { name: "0 دولار", amount: 0, weight: 15, tier: "low" },
  { name: "10 دولار", amount: 10, weight: 20, tier: "low" },
  { name: "50 دولار", amount: 50, weight: 20, tier: "low" },
  { name: "100 دولار", amount: 100, weight: 18, tier: "medium" },
  { name: "1,000 دولار", amount: 1000, weight: 12, tier: "medium" },
  { name: "2,000 دولار", amount: 2000, weight: 7, tier: "medium" },
  { name: "3,000 دولار", amount: 3000, weight: 4, tier: "high" },
  { name: "10,000 دولار", amount: 10000, weight: 2.5, tier: "high" },
  { name: "20,000 دولار", amount: 20000, weight: 1, tier: "high" },
  { name: "40,000 دولار", amount: 40000, weight: 0.5, tier: "high" },
];

function pickWeightedPrize(): WheelPrize {
  const totalWeight = WHEEL_PRIZES.reduce((acc, p) => acc + p.weight, 0);
  let random = Math.random() * totalWeight;
  for (const prize of WHEEL_PRIZES) {
    if (random < prize.weight) {
      return prize;
    }
    random -= prize.weight;
  }
  return WHEEL_PRIZES[0];
}

function buildWheelDisplay(prizeText: string, footerText: string) {
  return [
    `امر "عجلة" 🎡 عجلة الحظ: جاهزة للحظ`,
    ``,
    `      │`,
    `      │`,
    `      │`,
    `      │`,
    `  ${prizeText}`,
    `      │`,
    `      │`,
    `      │`,
    `      │`,
    ``,
    `${footerText}`,
  ].join("\n");
}

async function handleWheelCommand(target: any) {
  const user = target.author || target.user;
  const userId = user.id;

  if (activeGames.has(userId) || activeSessions.has(userId)) {
    const msg = "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.";
    if (target.reply) {
      if (target.deferred || target.replied) {
        await target.followUp({ content: msg, ephemeral: true });
      } else {
        await target.reply({ content: msg, ephemeral: target.isChatInputCommand?.() ? true : undefined });
      }
    }
    return;
  }

  activeGames.add(userId);

  const initialContent = buildWheelDisplay(
    "0",
    "شو راح يكون حظك يا حلو"
  );

  const spinButton = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId("spin_wheel_action")
      .setLabel("🎡 لف العجلة")
      .setStyle(ButtonStyle.Success)
  );

  let responseMsg: any;
  if (target.isChatInputCommand?.()) {
    responseMsg = await target.reply({
      content: initialContent,
      components: [spinButton],
      fetchReply: true,
    });
  } else {
    responseMsg = await target.reply({
      content: initialContent,
      components: [spinButton],
    });
  }

  const filter = (i: any) => i.customId === "spin_wheel_action" && i.user.id === userId;
  const collector = responseMsg.createMessageComponentCollector({
    filter,
    time: 30000,
  });

  let gameEnded = false;

  collector.on("collect", async (interaction: any) => {
    if (!interaction.isButton()) return;
    gameEnded = true;
    collector.stop("spun");

    const winningPrize = pickWeightedPrize();
    const profile = getUserProfile(userId);

    const disabledSpinBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("spin_wheel_action")
        .setLabel("🎡 جاري دوران العجلة...")
        .setStyle(ButtonStyle.Primary)
        .setDisabled(true)
    );

    await interaction.update({ components: [disabledSpinBtn] });

    const animPrizes = [
      "✨ 1,000 دولار ✨",
      "✨ 50 دولار ✨",
      "✨ 10,000 دولار ✨",
      "✨ 10 دولار ✨",
      "✨ 40,000 دولار ✨",
    ];

    for (let f = 0; f < animPrizes.length; f++) {
      const frameContent = buildWheelDisplay(
        animPrizes[f],
        "شو راح يكون حظك يا حلو"
      );
      await responseMsg.edit({ content: frameContent }).catch(() => {});
      await new Promise((r) => setTimeout(r, 250));
    }

    let footerPhrase = "حظك نحس.";
    if (winningPrize.tier === "medium") {
      footerPhrase = "حظك مش حلو قوي.";
    } else if (winningPrize.tier === "high") {
      footerPhrase = "حظك حلو!";
    }

    profile.wallet += winningPrize.amount;

    const finalContent = buildWheelDisplay(
      `🎉 **${winningPrize.name}** 🎉`,
      footerPhrase
    );

    const finalDisabledBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId("spin_wheel_action")
        .setLabel(`🏆 تم الربح: ${winningPrize.name}`)
        .setStyle(
          winningPrize.tier === "high"
            ? ButtonStyle.Success
            : winningPrize.tier === "medium"
            ? ButtonStyle.Primary
            : ButtonStyle.Secondary
        )
        .setDisabled(true)
    );

    await responseMsg
      .edit({
        content: finalContent,
        components: [finalDisabledBtn],
      })
      .catch(() => {});

    activeGames.delete(userId);
  });

  collector.on("end", async (_: any, reason: any) => {
    if (reason === "time" && !gameEnded) {
      activeGames.delete(userId);
      const timeoutContent = buildWheelDisplay(
        "❌ انتهى وقت الانتظار",
        "لم يتم لف العجلة."
      );
      const timeoutBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId("spin_wheel_action")
          .setLabel("⏱️ انتهت المهلة")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      );
      await responseMsg
        .edit({
          content: timeoutContent,
          components: [timeoutBtn],
        })
        .catch(() => {});
    }
  });
}

async function handleSalaryInteraction(interaction: ChatInputCommandInteraction) {
  const userId = interaction.user.id;
  if (activeGames.has(userId) || activeSessions.has(userId)) {
    await interaction.reply({
      content: "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
      ephemeral: true,
    });
    return;
  }
  activeGames.add(userId);
  const numberSet = new Set<number>();
  while (numberSet.size < 9) {
    numberSet.add(Math.floor(Math.random() * 99) + 1);
  }
  const numbers = Array.from(numberSet);
  const sortedNumbers = [...numbers].sort((a, b) => a - b);
  const rows = [];
  for (let i = 0; i < 3; i++) {
    const row = new ActionRowBuilder<any>();
    for (let j = 0; j < 3; j++) {
      const num = numbers[i * 3 + j];
      row.addComponents(
        new ButtonBuilder()
          .setCustomId(`salary_num_${num}`)
          .setLabel(num.toString())
          .setStyle(ButtonStyle.Secondary)
      );
    }
    rows.push(row);
  }
  const salaryEmbed = new EmbedBuilder()
    .setColor(2829617)
    .setAuthor({
      name: interaction.user.username,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setDescription(
      [
        `| **الراتب**`,
        ``,
        `يجب عليك ترتيب الاعداد تصاعدياً في 60 ثانية`,
        `في حال الفشل لن يتم ايداع مبلغ الراتب الى حسابك`,
      ].join("\n")
    )
    .setTimestamp();

  const responseMsg = await interaction.reply({
    embeds: [salaryEmbed],
    components: rows,
    fetchReply: true,
  });

  const filter = (i: any) =>
    i.customId.startsWith("salary_num_") && i.user.id === userId;
  const collector = responseMsg.createMessageComponentCollector({
    filter,
    time: 60000,
  });
  let nextIndex = 0;
  const clickedNumbers = new Set();
  collector.on("collect", async (btnInteraction: any) => {
    if (!btnInteraction.isButton()) return;
    const clickedNum = parseInt(
      btnInteraction.customId.replace("salary_num_", ""),
      10
    );
    const expectedNum = sortedNumbers[nextIndex];
    if (clickedNum === expectedNum) {
      clickedNumbers.add(clickedNum);
      nextIndex++;
      if (nextIndex === 9) {
        collector.stop("win");
        const profile = getUserProfile(userId);
        const reward = 50000;
        profile.wallet += reward;
        activeGames.delete(userId);
        const winRows = [];
        for (let i = 0; i < 3; i++) {
          const row = new ActionRowBuilder<any>();
          for (let j = 0; j < 3; j++) {
            const num = numbers[i * 3 + j];
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`salary_win_${num}`)
                .setLabel(num.toString())
                .setStyle(ButtonStyle.Success)
                .setDisabled(true)
            );
          }
          winRows.push(row);
        }
        const successEmbed = new EmbedBuilder()
          .setColor(65280)
          .setAuthor({
            name: interaction.user.username,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setDescription(
            [
              `| **الراتب**`,
              ``,
              `🏆 **تهانينا! لقد نجحت في ترتيب الأعداد تصاعدياً.**`,
              `💰 **تم إيداع مبلغ الراتب:** \`50,000 $\` في محفظتك.`,
              `👛 **رصيد محفظتك الجديد:** \`${profile.wallet.toLocaleString()} $\``,
            ].join("\n")
          )
          .setTimestamp();
        await btnInteraction.update({
          embeds: [successEmbed],
          components: winRows,
        });
      } else {
        const currentRows = [];
        for (let i = 0; i < 3; i++) {
          const row = new ActionRowBuilder<any>();
          for (let j = 0; j < 3; j++) {
            const num = numbers[i * 3 + j];
            const isClicked = clickedNumbers.has(num);
            row.addComponents(
              new ButtonBuilder()
                .setCustomId(`salary_num_${num}`)
                .setLabel(num.toString())
                .setStyle(
                  isClicked ? ButtonStyle.Success : ButtonStyle.Secondary
                )
                .setDisabled(isClicked)
            );
          }
          currentRows.push(row);
        }
        await btnInteraction.update({ components: currentRows });
      }
    } else {
      collector.stop("fail_wrong");
      activeGames.delete(userId);
      const failRows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder<any>();
        for (let j = 0; j < 3; j++) {
          const num = numbers[i * 3 + j];
          const isClicked = clickedNumbers.has(num);
          const isWrong = num === clickedNum;
          let style = ButtonStyle.Secondary;
          if (isClicked) style = ButtonStyle.Success;
          if (isWrong) style = ButtonStyle.Danger;
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`salary_fail_${num}`)
              .setLabel(num.toString())
              .setStyle(style)
              .setDisabled(true)
          );
        }
        failRows.push(row);
      }
      const failEmbed = new EmbedBuilder()
        .setColor(16711680)
        .setAuthor({
          name: interaction.user.username,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **الراتب**`,
            ``,
            `❌ **فشل الحصول على الراتب!**`,
            `لقد قمت باختيار عدد خاطئ. ترتيب الأعداد كان يجب أن يكون تصاعدياً.`,
          ].join("\n")
        )
        .setTimestamp();
      await btnInteraction.update({
        embeds: [failEmbed],
        components: failRows,
      });
    }
  });

  collector.on("end", async (_: any, reason: any) => {
    if (reason === "time" && activeGames.has(userId)) {
      activeGames.delete(userId);
      const timeoutEmbed = new EmbedBuilder()
        .setColor(16711680)
        .setAuthor({
          name: interaction.user.username,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **الراتب**`,
            ``,
            `⏰ **انتهى الوقت (60 ثانية)!**`,
            `لم تقم بإكمال ترتيب الأعداد في الوقت المحدد.`,
          ].join("\n")
        )
        .setTimestamp();
      await responseMsg.edit({ embeds: [timeoutEmbed], components: [] }).catch(() => {});
    }
  });
}

async function handleTimeInteraction(interaction: ChatInputCommandInteraction) {
  const commandsList = [
    { name: "عجلة", key: "عجلة" },
    { name: "الراتب", key: "الراتب" },
    { name: "استثمار", key: "استثمار" },
    { name: "تداول", key: "تداول" },
    { name: "شراء", key: "شراء" },
    { name: "بيع", key: "بيع" },
    { name: "ايموجي", key: "ايموجي" },
    { name: "رياضيات", key: "رياضيات" },
    { name: "لغز", key: "لغز" },
    { name: "زر", key: "زر" },
    { name: "تحدي", key: "تحدي" },
    { name: "لعبه", key: "game" },
    { name: "نهب", key: "نهب" },
    { name: "حماية", key: "حماية" },
    { name: "ممتلكات", key: "ممتلكات" },
    { name: "توب", key: "توب" },
  ];
  const lines = [];
  for (const cmd of commandsList) {
    const cmdKey = COMMAND_KEY_MAP[cmd.key] || cmd.key;
    const remainingMs = cooldownManager.getRemaining(cmdKey, interaction.user.id);
    let isCooldown = false;
    let remainingStr = "";
    if (remainingMs > 0) {
      isCooldown = true;
      const totalSeconds = remainingMs / 1e3;
      const minutes = Math.floor(totalSeconds / 60);
      const seconds = Math.floor(totalSeconds % 60);
      const tenths = Math.floor((remainingMs % 1e3) / 100);
      remainingStr = ` : ${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
    }
    const circle = isCooldown ? "🔴" : "🟢";
    lines.push(`‏${circle} ${cmd.name}${remainingStr}`);
  }
  const embed = new EmbedBuilder()
    .setColor(2829617)
    .setAuthor({
      name: interaction.user.username,
      iconURL: interaction.user.displayAvatarURL(),
    })
    .setDescription([`| **وقت**`, ``, ...lines].join("\n"))
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

client.on("interactionCreate", async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;
    const cmd = interaction.commandName;

    if (allowedChannels.length > 0 && !allowedChannels.includes(interaction.channelId)) {
      await interaction.reply({
        content: `⚠️ **هذا الروم غير مفعل لأوامر البوت.** يرجى استخدام أحد الرومات المفعلة: ${allowedChannels.map((id) => `<#${id}>`).join(" ، ")}`,
        ephemeral: true,
      });
      return;
    }

    if (cmd === "wheel" || cmd === "ajil") {
      if (!(await checkCooldown(interaction.user.id, "عجلة", interaction))) return;
      await handleWheelCommand(interaction);
      return;
    }

    if (cmd === "top") {
      if (!(await checkCooldown(interaction.user.id, "top", interaction))) return;
      const guildIconUrl = interaction.guild?.iconURL({ size: 256 }) || client.user?.displayAvatarURL({ size: 256 });
      const embed = buildTopEmbed(interaction.user.username, interaction.user.displayAvatarURL(), guildIconUrl);
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (cmd === "prices") {
      if (!(await checkCooldown(interaction.user.id, "prices", interaction))) return;
      const isEn = botLanguage === "en";
      const embed = getMarketEmbed(
        interaction.guild,
        interaction.user.username,
        interaction.user.displayAvatarURL(),
        botLanguage
      );
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("prices_info_select")
        .setPlaceholder(isEn ? "Price Inquiry" : "استفسار عن أسعار المنتجات")
        .addOptions(
          marketItems.map((item) => ({
            label: isEn ? item.nameEn : item.name,
            value: item.id,
            emoji: item.emoji,
            description: isEn ? `Price inquiry for ${item.nameEn}` : `استفسار عن سعر ${item.name}`,
          }))
        );
      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      await interaction.reply({ embeds: [embed], components: [row] });
      return;
    }

    if (cmd === "properties") {
      if (!(await checkCooldown(interaction.user.id, "ممتلكات", interaction))) return;
      const profile = getUserProfile(interaction.user.id);
      const itemsList = Object.entries(profile.inventory)
        .filter(([_, qty]) => qty > 0)
        .map(([id, qty]) => {
          const item = marketItems.find((i) => i.id === id);
          return item ? `${item.emoji} **${item.name}:** \`${qty}\`` : null;
        })
        .filter(Boolean);

      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
          name: interaction.user.username,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle("📦 كشف حساب وممتلكات العضو | Fire Bank")
        .setDescription(
          [
            `أهلاً بك <@${interaction.user.id}>، فيما يلي كشف بجميع ممتلكاتك وأصولك المالية:`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `👛 **المحفظة:** \`${profile.wallet.toLocaleString()} $\``,
            `🏦 **البنك:** \`${profile.bank.toLocaleString()} $\``,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `📦 **المحتويات والممتلكات:**`,
            itemsList.length > 0 ? itemsList.join("\n") : "لا تملك أي ممتلكات حالياً.",
          ].join("\n")
        )
        .setTimestamp();
      await interaction.reply({ embeds: [embed] });
      return;
    }

    if (cmd === "salary") {
      if (!(await checkCooldown(interaction.user.id, "الراتب", interaction))) return;
      await handleSalaryInteraction(interaction);
      return;
    }

    if (cmd === "riddle") {
      if (!(await checkCooldown(interaction.user.id, "لغز", interaction))) return;
      await interaction.reply({ content: "🧩 **للبدء في اللغز، يرجى كتابة الأمر النصي:** `لغز`" });
      return;
    }

    if (cmd === "math") {
      if (!(await checkCooldown(interaction.user.id, "رياضيات", interaction))) return;
      await interaction.reply({ content: "🧮 **للبدء في لعبة الرياضيات، يرجى كتابة الأمر النصي:** `رياضيات`" });
      return;
    }

    if (cmd === "emoji") {
      if (!(await checkCooldown(interaction.user.id, "ايموجي", interaction))) return;
      await interaction.reply({ content: "😀 **للبدء في تلميح الايموجي، يرجى كتابة الأمر النصي:** `ايموجي`" });
      return;
    }

    if (cmd === "invest") {
      if (!(await checkCooldown(interaction.user.id, "استثمار", interaction))) return;
      await interaction.reply({ content: "📈 **للاستثمار في الأسهم، يرجى كتابة الأمر النصي:** `استثمار`" });
      return;
    }

    if (cmd === "trade") {
      if (!(await checkCooldown(interaction.user.id, "تداول", interaction))) return;
      await interaction.reply({ content: "💹 **لتداول الأصول المالية، يرجى كتابة الأمر النصي:** `تداول`" });
      return;
    }

    if (cmd === "buy") {
      if (!(await checkCooldown(interaction.user.id, "شراء", interaction))) return;
      await interaction.reply({ content: "🛒 **لشراء السلع من السوق، يرجى كتابة الأمر النصي:** `شراء <اسم_السلعة>`" });
      return;
    }

    if (cmd === "sell") {
      if (!(await checkCooldown(interaction.user.id, "بيع", interaction))) return;
      await interaction.reply({ content: "🏷️ **لبيع السلع للسوق، يرجى كتابة الأمر النصي:** `بيع <اسم_السلعة>`" });
      return;
    }

    if (cmd === "time") {
      await handleTimeInteraction(interaction);
      return;
    }

    if (
      cmd === "abb-channel" ||
      cmd === "cancel-room" ||
      cmd === "choose-language"
    ) {
      const isConfigOwner =
        interaction.user.id === interaction.guild?.ownerId ||
        (interaction.memberPermissions &&
          interaction.memberPermissions.has("Administrator"));
      if (!isConfigOwner) {
        await interaction.reply({
          content: "❌ **هذا الأمر مخصص لمدراء السيرفر فقط!** / ❌ **This command is for server administrators only!**",
          ephemeral: true,
        });
        return;
      }
    }

    if (cmd === "abb-channel") {
      const ch1 = interaction.options.getChannel("channel1");
      const ch2 = interaction.options.getChannel("channel2");
      const ch3 = interaction.options.getChannel("channel3");
      const tempChannels = [];
      if (ch1) tempChannels.push(ch1.id);
      if (ch2) tempChannels.push(ch2.id);
      if (ch3) tempChannels.push(ch3.id);
      allowedChannels = tempChannels;
      saveAllowedChannels(allowedChannels);
      const channelListString = allowedChannels
        .map((id: any) => `<#${id}>`)
        .join(" ، ");
      await interaction.reply({
        content: `✅ **تم تفعيل البوت بنجاح في الغرف المحددة:**
• ${channelListString}
*(لن يستجيب البوت لأي أمر خارج هذه الغرف)*`,
      });
      return;
    }

    if (cmd === "cancel-room") {
      const ch = interaction.options.getChannel("channel");
      if (!ch) return;
      const targetChannelId = ch.id;
      if (allowedChannels.includes(targetChannelId)) {
        allowedChannels = allowedChannels.filter((id) => id !== targetChannelId);
        saveAllowedChannels(allowedChannels);
        await interaction.reply({
          content: `✅ **تم إلغاء تفعيل البوت في الروم <#${targetChannelId}> بنجاح!**\n*(لن يستجيب البوت للأوامر هناك بعد الآن)*`,
        });
      } else {
        await interaction.reply({
          content: `⚠️ **الروم <#${targetChannelId}> غير مضاف إلى القنوات المفعلة بالفعل.**`,
          ephemeral: true,
        });
      }
      return;
    }

    if (cmd === "choose-language") {
      const selectedLang = interaction.options.getString("language");
      if (selectedLang === "ar" || selectedLang === "en") {
        botLanguage = selectedLang;
        saveLanguage(botLanguage);
        if (botLanguage === "ar") {
          await interaction.reply({
            content: `✅ **تم تغيير لغة مساعد البوت إلى اللغة العربية بنجاح!**`,
          });
        } else {
          await interaction.reply({
            content: `✅ **Bot assistant language has been successfully changed to English!**`,
          });
        }
      }
      return;
    }

    if (
      cmd === "add_money" ||
      cmd === "got"
    ) {
      const isConfigOwner =
        interaction.user.id === interaction.guild?.ownerId ||
        (interaction.memberPermissions &&
          interaction.memberPermissions.has("Administrator"));
      if (!isConfigOwner) {
        await interaction.reply({
          content:
            "❌ **هذا الأمر مخصص لمدراء السيرفر فقط!** / ❌ **This command is for server administrators only!**",
          ephemeral: true,
        });
        return;
      }

      const targetUser = interaction.options.getUser("user");
      const amount =
        interaction.options.getNumber("money") ||
        interaction.options.getInteger("money");

      if (!targetUser) {
        await interaction.reply({
          content: "❌ الرجاء تحديد العضو المراد إضافة المبلغ له.",
          ephemeral: true,
        });
        return;
      }

      if (targetUser.bot) {
        await interaction.reply({
          content: "❌ لا يمكنك إضافة أموال إلى بوت!",
          ephemeral: true,
        });
        return;
      }

      if (!amount || amount <= 0) {
        await interaction.reply({
          content: "❌ الرجاء إدخال مبلغ مالي صحيح وأكبر من الصفر.",
          ephemeral: true,
        });
        return;
      }

      const maxLimit = 1000000000000;
      if (amount > maxLimit) {
        await interaction.reply({
          content:
            "❌ **الحد الأقصى المسموح بإضافته هو 1 تريليون $ (1,000,000,000,000 $).**",
          ephemeral: true,
        });
        return;
      }

      const targetProfile = getUserProfile(targetUser.id);
      targetProfile.wallet += amount;

      const embed = new EmbedBuilder()
        .setColor(65280)
        .setAuthor({
          name: interaction.user.username,
          iconURL: interaction.user.displayAvatarURL(),
        })
        .setTitle("💰 تم إضافة الأموال بنجاح!")
        .setDescription(
          [
            `قام <@${interaction.user.id}> بإضافة مبلغ **${amount.toLocaleString("en-US")} $** إلى محفظة <@${targetUser.id}>.`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `👛 **رصيد محفظة <@${targetUser.id}> الجديد:** \`${targetProfile.wallet.toLocaleString("en-US")} $\``,
          ].join("\n"),
        )
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
      return;
    }
  } catch (err) {
    console.error("Error in interactionCreate:", err);
  }
});
client.on("messageCreate", async (message) => {
  try {
    if (message.author.bot) return;
    if (!message.guild) {
      const dmContent = message.content.trim().toLowerCase();
      if (
        dmContent === "مسح" ||
        dmContent === "تصفير الذاكرة" ||
        dmContent === "reset"
      ) {
        openRouterService.resetHistory(message.author.id);
        await message.reply(
          "🧹 **تم مسح ذاكرة وسياق المحادثة بنجاح!** يمكنك بدء حوار جديد الآن.",
        );
        return;
      }
      if (openRouterService.hasValidKey()) {
        try {
          await message.channel.sendTyping();
          const languagePrompt = botLanguage === "en"
            ? "\n\nImportant: You must speak and respond strictly in English."
            : "\n\nهام: يجب عليك التحدث والرد باللغة العربية فقط.";
          const liveContext = getAiContextString(message.author.id) + languagePrompt;
          const aiResponse = await openRouterService.generateResponse(
            message.author.id,
            message.content.trim(),
            liveContext,
          );
          await message.reply(aiResponse);
        } catch (error) {
          console.error("Error handling AI DM response:", error);
          await message.reply("❌ حدث خطأ أثناء معالجة طلبك.");
        }
      } else {
        await message.reply(
          [
            `أنا المساعد الذكي الخاص بـ **Fire Bank** 🪙.`,
            `أنا مخصص ومبرمج للتعريف بالبوت ومهامه فقط.`,
            ``,
            `يمكنك الاستفسار عن أحد المواضيع التالية وكتابة كلماتها المفتاحية:`,
            `• 🎮 **الألعاب** (اكتب: ألعاب أو لعبة أو رياضيات)`,
            `• 📈 **التداول والاستثمار** (اكتب: تداول أو استثمار)`,
            `• 🛍️ **السوق المالي** (اكتب: اسعار أو شراء أو بيع)`,
            `• 🛠️ **إعداد السيرفر** (اكتب: تفعيل أو روم)`,
          ].join("\n"),
        );
      }
      return;
    }
    if (!message.guild) return;
    const content = message.content.trim();
    const botMentionPrefix = `<@${client.user?.id}>`;
    const botMentionPrefixNick = `<@!${client.user?.id}>`;
    const isRoomConfigMention =
      (content.startsWith(botMentionPrefix) ||
        content.startsWith(botMentionPrefixNick)) &&
      content.toLowerCase().includes("room");
    const isArabicRoomMention =
      (content.startsWith(botMentionPrefix) ||
        content.startsWith(botMentionPrefixNick)) &&
      content.includes("روم");
    const isMentioned =
      client.user &&
      message.mentions.has(client.user) &&
      !message.mentions.everyone;
    const isCancelCmd =
      content.toLowerCase().startsWith("/cancel-room") ||
      content.toLowerCase().startsWith("cancel-room") ||
      content.toLowerCase().startsWith("/cancel rom") ||
      content.toLowerCase().startsWith("cancel rom");

    const isSetupCmd =
      content.startsWith("/abb-channel") ||
      content.startsWith("abb-channel") ||
      isRoomConfigMention ||
      isArabicRoomMention ||
      isCancelCmd;
    if (!isSetupCmd && !isMentioned) {
      if (allowedChannels.length > 0) {
        if (!allowedChannels.includes(message.channel.id)) return;
      }
    }
    console.log(`Received: "${content}"`);
    const lowerTrimmed = content.toLowerCase().trim();

    if (
      content.startsWith("got") ||
      content.startsWith("add_money") ||
      content.startsWith("/got") ||
      content.startsWith("/add_money")
    ) {
      const isConfigOwner =
        message.author.id === message.guild.ownerId ||
        (message.member?.permissions &&
          message.member.permissions.has("Administrator"));
      if (!isConfigOwner) {
        await message.reply("❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**");
        return;
      }

      const match = content.match(
        /^(?:\/)?(?:got|add_money)\s+(<@!?\d+>)\s+(\d+)$/,
      );
      if (!match) {
        await message.reply(
          "⚠️ **طريقة كتابة الأمر:** `got` `@العضو` `المبلغ`\n*(مثال: `got @العضو 5000`)*",
        );
        return;
      }

      const victimId = match[1].replace(/[<@!>]/g, "");
      const amount = parseInt(match[2], 10);

      const targetUser =
        message.mentions.users.get(victimId) ||
        (await client.users.fetch(victimId).catch(() => null));
      if (!targetUser) {
        await message.reply("❌ لم يتم العثور على العضو المحدد.");
        return;
      }

      if (targetUser.bot) {
        await message.reply("❌ لا يمكنك إضافة أموال إلى بوت!");
        return;
      }

      if (isNaN(amount) || amount <= 0) {
        await message.reply("❌ الرجاء إدخال مبلغ مالي صحيح وأكبر من الصفر.");
        return;
      }

      const maxLimit = 1000000000000;
      if (amount > maxLimit) {
        await message.reply(
          "❌ **الحد الأقصى المسموح بإضافته هو 1 تريليون $ (1,000,000,000,000 $).**",
        );
        return;
      }

      const targetProfile = getUserProfile(victimId);
      targetProfile.wallet += amount;

      const guildIconUrl =
        message.guild.iconURL({ size: 256 }) ||
        client.user?.displayAvatarURL({ size: 256 });
      const embed = new EmbedBuilder()
        .setColor(65280)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTitle("💰 تم إضافة الأموال بنجاح!")
        .setDescription(
          [
            `قام <@${message.author.id}> بإضافة مبلغ **${amount.toLocaleString("en-US")} $** إلى محفظة <@${victimId}>.`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `👛 **رصيد محفظة <@${victimId}> الجديد:** \`${targetProfile.wallet.toLocaleString("en-US")} $\``,
          ].join("\n"),
        )
        .setTimestamp();
      if (guildIconUrl) embed.setThumbnail(guildIconUrl);

      await message.reply({ embeds: [embed] });
      return;
    }
    if (
      lowerTrimmed === "لغة" ||
      lowerTrimmed === "لغه" ||
      lowerTrimmed === "language" ||
      lowerTrimmed.startsWith("لغة ") ||
      lowerTrimmed.startsWith("لغه ") ||
      lowerTrimmed.startsWith("language ")
    ) {
      if (
        lowerTrimmed.includes("en") ||
        lowerTrimmed.includes("english") ||
        lowerTrimmed.includes("انجليزي") ||
        lowerTrimmed.includes("إنجليزي")
      ) {
        botLanguage = "en";
        saveLanguage("en");
        await message.reply("✅ **Bot assistant and prices language changed to English!**");
      } else if (
        lowerTrimmed.includes("ar") ||
        lowerTrimmed.includes("arabic") ||
        lowerTrimmed.includes("عربي") ||
        lowerTrimmed.includes("عربية")
      ) {
        botLanguage = "ar";
        saveLanguage("ar");
        await message.reply("✅ **تم تغيير لغة المساعد والأسعار إلى اللغة العربية بنجاح!**");
      } else {
        const cur = botLanguage === "en" ? "English" : "العربية";
        await message.reply(
          botLanguage === "en"
            ? `🌐 **Current language:** \`${cur}\`.\nTo change language, type: \`language ar\` or \`language en\` or use \`/choose-language\`.`
            : `🌐 **اللغة الحالية:** \`${cur}\`.\nلتغيير اللغة اكتب: \`لغة عربي\` أو \`لغة انجليزي\` أو استخدم الأمر \`/choose-language\`.`
        );
      }
      return;
    }
    if (isCancelCmd) {
      const isConfigOwner =
        message.author.id === message.guild?.ownerId ||
        (message.member && message.member.permissions.has("Administrator"));
      if (!isConfigOwner) {
        await message.reply("❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**");
        return;
      }

      const channelMatch = content.match(/<#(\d+)>/);
      if (!channelMatch) {
        await message.reply(
          `⚠️ **طريقة كتابة الأمر:** \`/Cancel rom\` \`منشن الروم\`\n*(مثال: \`/Cancel rom\` <#${message.channel.id}>)*`
        );
        return;
      }

      const targetChannelId = channelMatch[1];
      if (allowedChannels.includes(targetChannelId)) {
        allowedChannels = allowedChannels.filter((id) => id !== targetChannelId);
        saveAllowedChannels(allowedChannels);
        await message.reply(
          `✅ **تم إلغاء تفعيل البوت في الروم <#${targetChannelId}> بنجاح!**\n*(لن يستجيب البوت للأوامر هناك بعد الآن)*`,
        );
      } else {
        await message.reply(`⚠️ **الروم <#${targetChannelId}> غير مضاف إلى القنوات المفعلة بالفعل.**`);
      }
      return;
    }

    if (content.startsWith("زر")) {
      const match = content.match(/^زر\s+(<@!?\d+>)\s+(\d+)$/);
      if (!match) {
        if (content === "زر") {
          const embed = new EmbedBuilder()
            .setColor(2829617)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **زر**`,
                ``,
                `**طريقة الأستخدام :**`,
                `\`زر\` \`المنشن\` \`المبلغ\``,
              ].join("\n"),
            )
            .setTimestamp();
          await message.reply({ embeds: [embed] });
        } else {
          await message.reply(
            "⚠️ **طريقة كتابة الأمر:** `زر` `المنشن` `المبلغ`\n*(مثال: زر @العضو 10000)*",
          );
        }
        return;
      }
      if (!(await checkCooldown(message.author.id, "زر", message))) return;
      if (!(await checkCooldown(message.author.id, "تحدي", message))) return;
      const victimId = match[1].replace(/[<@!>]/g, "");
      const amount = parseInt(match[2], 10);
      if (isNaN(amount) || amount <= 0) {
        await message.reply("❌ الرجاء إدخال مبلغ صحيح وأكبر من الصفر.");
        return;
      }
      if (victimId === message.author.id) {
        await message.reply("❌ لا يمكنك تحدي نفسك!");
        return;
      }
      if (victimId === client.user?.id) {
        await message.reply("❌ لا يمكنك تحدي البوت!");
        return;
      }
      const challengerProfile = getUserProfile(message.author.id);
      const challengedProfile = getUserProfile(victimId);
      if (challengerProfile.wallet < amount) {
        await message.reply(
          `❌ ليس لديك رصيد كافٍ في المحفظة! رصيدك الحالي: \`${challengerProfile.wallet.toLocaleString()} $\``,
        );
        return;
      }
      if (challengedProfile.wallet < amount) {
        await message.reply(
          `❌ الطرف الآخر لا يملك رصيداً كافياً في المحفظة لإتمام هذا التحدي!`,
        );
        return;
      }
      if (
        activeGames.has(message.author.id) ||
        activeSessions.has(message.author.id)
      ) {
        await message.reply(
          "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }
      if (activeGames.has(victimId) || activeSessions.has(victimId)) {
        await message.reply(
          "⚠️ **الطرف الآخر مشغول بلعبة أو عملية أخرى حالياً!**",
        );
        return;
      }
      activeGames.add(message.author.id);
      activeGames.add(victimId);
      const challengeEmbed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **زر**`,
            ``,
            `قام <@${message.author.id}> بتحديك على مبلغ **${amount.toLocaleString()} $** <@${victimId}>`,
            ``,
            `سيتم اختيار الزر بعد عدة ثواني`,
            `اول من يضغط على الزر المختار سيربح التحدي`,
          ].join("\n"),
        )
        .setTimestamp();
      const acceptBtn = new ButtonBuilder()
        .setCustomId(
          `challenge_accept_${message.author.id}_${victimId}_${amount}`,
        )
        .setLabel("قبول")
        .setStyle(ButtonStyle.Success);
      const declineBtn = new ButtonBuilder()
        .setCustomId(
          `challenge_decline_${message.author.id}_${victimId}_${amount}`,
        )
        .setLabel("رفض")
        .setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder<any>().addComponents(
        acceptBtn,
        declineBtn,
      );
      const challengeMsg = await message.reply({
        content: `<@${message.author.id}> - <@${victimId}>`,
        embeds: [challengeEmbed],
        components: [row],
      });
      const challengeFilter = (i: any) =>
        (i.customId.startsWith("challenge_accept_") ||
          i.customId.startsWith("challenge_decline_")) &&
        i.user.id === victimId;
      const challengeCollector = challengeMsg.createMessageComponentCollector({
        filter: challengeFilter,
        componentType: ComponentType.Button,
        time: 60000,
      });
      challengeCollector.on("collect", async (interaction) => {
        challengeCollector.stop();
        if (interaction.customId.startsWith("challenge_decline_")) {
          activeGames.delete(message.author.id);
          activeGames.delete(victimId);
          const declinedEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(`❌ تم رفض التحدي من قبل <@${victimId}>.`)
            .setTimestamp();
          await interaction.update({
            content: null,
            embeds: [declinedEmbed],
            components: [],
          });
          return;
        }
        const freshChallenger = getUserProfile(message.author.id);
        const freshChallenged = getUserProfile(victimId);
        if (
          freshChallenger.wallet < amount ||
          freshChallenged.wallet < amount
        ) {
          activeGames.delete(message.author.id);
          activeGames.delete(victimId);
          const errorEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              `❌ فشل بدء التحدي بسبب نقص الرصيد لدى أحد الطرفين.`,
            )
            .setTimestamp();
          await interaction.update({
            content: null,
            embeds: [errorEmbed],
            components: [],
          });
          return;
        }
        freshChallenger.wallet -= amount;
        freshChallenged.wallet -= amount;
        const preparingEmbed = new EmbedBuilder()
          .setColor(2829617)
          .setAuthor({
            name: message.author.username,
            iconURL: message.author.displayAvatarURL(),
          })
          .setDescription(
            [
              `| **زر**`,
              ``,
              `🟢 **تم قبول التحدي!**`,
              `جاري تجهيز الأزرار واختيار الزر الفائز عشوائياً...`,
              `يرجى الانتظار والاستعداد للضغط بسرعة! ⚡`,
            ].join("\n"),
          )
          .setTimestamp();
        await interaction.update({
          content: `<@${message.author.id}> - <@${victimId}>`,
          embeds: [preparingEmbed],
          components: [],
        });
        const delay = Math.floor(Math.random() * 3e3) + 3e3;
        setTimeout(async () => {
          try {
            const targetBtnIdx = Math.floor(Math.random() * 4);
            const buttonLabels = ["زر 1", "زر 2", "زر 3", "زر 4"];
            const gameRow = new ActionRowBuilder<any>();
            for (let i = 0; i < 4; i++) {
              gameRow.addComponents(
                new ButtonBuilder()
                  .setCustomId(
                    `game_btn_${i}_${message.author.id}_${victimId}_${amount}_${targetBtnIdx}`,
                  )
                  .setLabel(buttonLabels[i])
                  .setStyle(ButtonStyle.Primary),
              );
            }
            const readyEmbed = new EmbedBuilder()
              .setColor(5793266)
              .setAuthor({
                name: message.author.username,
                iconURL: message.author.displayAvatarURL(),
              })
              .setDescription(
                [
                  `| **زر**`,
                  ``,
                  `⚡ **الأزرار جاهزة الآن!**`,
                  `اضغط على **الزر رقم ${targetBtnIdx + 1}** بأسرع ما يمكن لتفوز!`,
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                  `الرهان الكلي: **${(amount * 2).toLocaleString()} $**`,
                ].join("\n"),
              )
              .setTimestamp();
            const gameMsg = await challengeMsg.edit({
              embeds: [readyEmbed],
              components: [gameRow],
            });
            const gameFilter = (i: any) =>
              i.customId.startsWith("game_btn_") &&
              (i.user.id === message.author.id || i.user.id === victimId);
            const gameCollector = gameMsg.createMessageComponentCollector({
              filter: gameFilter,
              componentType: ComponentType.Button,
              time: 30000,
            });
            gameCollector.on("collect", async (gameInt) => {
              const parts = gameInt.customId.split("_");
              const clickedIdx = parseInt(parts[2], 10);
              const winningIdx = parseInt(parts[6], 10);
              const gameAmount = parseInt(parts[5], 10);
              const winnerId = gameInt.user.id;
              if (clickedIdx === winningIdx) {
                gameCollector.stop("winner");
                const winnerProfile = getUserProfile(winnerId);
                const pot = gameAmount * 2;
                winnerProfile.wallet += pot;
                activeGames.delete(message.author.id);
                activeGames.delete(victimId);
                const endRow = new ActionRowBuilder<any>();
                for (let i = 0; i < 4; i++) {
                  const btn = new ButtonBuilder()
                    .setCustomId(`game_btn_${i}`)
                    .setLabel(buttonLabels[i])
                    .setDisabled(true);
                  if (i === winningIdx) {
                    btn.setStyle(ButtonStyle.Success);
                  } else {
                    btn.setStyle(ButtonStyle.Secondary);
                  }
                  endRow.addComponents(btn);
                }
                const winEmbed = new EmbedBuilder()
                  .setColor(65280)
                  .setAuthor({
                    name: gameInt.user.username,
                    iconURL: gameInt.user.displayAvatarURL(),
                  })
                  .setDescription(
                    [
                      `| **زر**`,
                      ``,
                      `🏆 **مبروك! فاز <@${winnerId}> في التحدي!**`,
                      `لقد كان الأسرع في الضغط على الزر الصحيح (**زر رقم ${winningIdx + 1}**).`,
                      `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                      `💰 **الجائزة المحققة:** \`${pot.toLocaleString()} $\``,
                      `👛 **رصيد محفظة الفائز الجديد:** \`${winnerProfile.wallet.toLocaleString()} $\``,
                    ].join("\n"),
                  )
                  .setTimestamp();
                await gameInt.update({
                  content: null,
                  embeds: [winEmbed],
                  components: [endRow],
                });
              } else {
                await gameInt.reply({
                  content:
                    "❌ **هذا ليس الزر المختار!** حاول مرة أخرى بالضغط على الزر الصحيح.",
                  ephemeral: true,
                });
              }
            });
            gameCollector.on("end", async (collected, reason) => {
              if (reason !== "winner") {
                activeGames.delete(message.author.id);
                activeGames.delete(victimId);
                const timeoutRow = new ActionRowBuilder<any>();
                for (let i = 0; i < 4; i++) {
                  timeoutRow.addComponents(
                    new ButtonBuilder()
                      .setCustomId(`game_btn_disabled_${i}`)
                      .setLabel(buttonLabels[i])
                      .setStyle(ButtonStyle.Secondary)
                      .setDisabled(true),
                  );
                }
                const refundChallenger = getUserProfile(message.author.id);
                const refundChallenged = getUserProfile(victimId);
                refundChallenger.wallet += amount;
                refundChallenged.wallet += amount;
                const timeoutEmbed = new EmbedBuilder()
                  .setColor(16711680)
                  .setAuthor({
                    name: message.author.username,
                    iconURL: message.author.displayAvatarURL(),
                  })
                  .setDescription(
                    [
                      `| **زر**`,
                      ``,
                      `⏱️ **انتهى الوقت ولم يضغط أحد على الزر الصحيح!**`,
                      `تم إرجاع مبلغ الرهان (\`${amount.toLocaleString()} $\`) لكلا اللاعبين.`,
                    ].join("\n"),
                  )
                  .setTimestamp();
                try {
                  await challengeMsg.edit({
                    content: null,
                    embeds: [timeoutEmbed],
                    components: [timeoutRow],
                  });
                } catch (err) {
                  console.error("Error updating game msg on timeout:", err);
                }
              }
            });
          } catch (err) {
            console.error("Error starting game buttons step:", err);
            activeGames.delete(message.author.id);
            activeGames.delete(victimId);
          }
        }, delay);
      });
      challengeCollector.on("end", async (collected, reason) => {
        if (reason === "time") {
          activeGames.delete(message.author.id);
          activeGames.delete(victimId);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              `⏱️ **انتهت الـ 60 ثانية المتاحة للموافقة دون رد من <@${victimId}>.** تم إلغاء التحدي تلقائياً.`,
            )
            .setTimestamp();
          try {
            await challengeMsg.edit({
              content: null,
              embeds: [timeoutEmbed],
              components: [],
            });
          } catch (err) {
            console.error("Error editing challenge msg on timeout:", err);
          }
        }
      });
      return;
    }
    if (content.startsWith("تحدي")) {
      const match = content.match(/^تحدي\s+(<@!?\d+>)\s+(\d+)$/);
      if (!match) {
        if (content === "تحدي") {
          const embed = new EmbedBuilder()
            .setColor(2829617)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **تحدي**`,
                ``,
                `**طريقة الإستخدام :**`,
                `\`تحدي\` \`المنشن\` \`المبلغ\``,
              ].join("\n"),
            )
            .setTimestamp();
          await message.reply({ embeds: [embed] });
        } else {
          await message.reply(
            "⚠️ **طريقة كتابة الأمر:** `تحدي` `المنشن` `المبلغ`\n*(مثال: تحدي @العضو 5000)*",
          );
        }
        return;
      }
      const victimId = match[1].replace(/[<@!>]/g, "");
      const amount = parseInt(match[2], 10);
      if (isNaN(amount) || amount <= 0) {
        await message.reply("❌ الرجاء إدخال مبلغ صحيح وأكبر من الصفر.");
        return;
      }
      if (victimId === message.author.id) {
        await message.reply("❌ لا يمكنك تحدي نفسك!");
        return;
      }
      if (victimId === client.user?.id) {
        await message.reply("❌ لا يمكنك تحدي البوت!");
        return;
      }
      const challengerProfile = getUserProfile(message.author.id);
      const challengedProfile = getUserProfile(victimId);
      if (challengerProfile.wallet < amount) {
        await message.reply(
          `❌ ليس لديك رصيد كافٍ في المحفظة! رصيدك الحالي: \`${challengerProfile.wallet.toLocaleString()} $\``,
        );
        return;
      }
      if (challengedProfile.wallet < amount) {
        await message.reply(
          `❌ الطرف الآخر لا يملك رصيداً كافياً في المحفظة لإتمام هذا التحدي!`,
        );
        return;
      }
      if (
        activeGames.has(message.author.id) ||
        activeSessions.has(message.author.id)
      ) {
        await message.reply(
          "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }
      if (activeGames.has(victimId) || activeSessions.has(victimId)) {
        await message.reply(
          "⚠️ **الطرف الآخر مشغول بلعبة أو عملية أخرى حالياً!**",
        );
        return;
      }
      activeGames.add(message.author.id);
      activeGames.add(victimId);
      const guildIconUrl =
        message.guild?.iconURL({ size: 256 }) ||
        client.user?.displayAvatarURL({ size: 256 });
      const challengeEmbed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **تحدي**`,
            ``,
            `قام <@${message.author.id}> يطلب تحدي <@${victimId}>`,
            `المبلغ : **${amount.toLocaleString()}**`,
            `في حال القبول والفوز سيتم اضافة المبلغ الى رصيدك`,
            `في حال الخسارة سيتم خصم المبلغ منك واضافته الى رصيد المتحدي`,
          ].join("\n"),
        )
        .setTimestamp();
      if (guildIconUrl) {
        challengeEmbed.setThumbnail(guildIconUrl);
      }
      const acceptBtn = new ButtonBuilder()
        .setCustomId(`bet_accept_${message.author.id}_${victimId}_${amount}`)
        .setLabel("قبول")
        .setStyle(ButtonStyle.Success);
      const declineBtn = new ButtonBuilder()
        .setCustomId(`bet_decline_${message.author.id}_${victimId}_${amount}`)
        .setLabel("رفض")
        .setStyle(ButtonStyle.Danger);
      const row = new ActionRowBuilder<any>().addComponents(
        acceptBtn,
        declineBtn,
      );
      const challengeMsg = await message.reply({
        content: `<@${victimId}> - <@${message.author.id}>`,
        embeds: [challengeEmbed],
        components: [row],
      });
      const challengeFilter = (i: any) =>
        (i.customId.startsWith("bet_accept_") ||
          i.customId.startsWith("bet_decline_")) &&
        i.user.id === victimId;
      const challengeCollector = challengeMsg.createMessageComponentCollector({
        filter: challengeFilter,
        componentType: ComponentType.Button,
        time: 60000,
      });
      challengeCollector.on("collect", async (interaction) => {
        challengeCollector.stop();
        if (interaction.customId.startsWith("bet_decline_")) {
          activeGames.delete(message.author.id);
          activeGames.delete(victimId);
          const declinedEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(`❌ تم رفض التحدي من قبل <@${victimId}>.`)
            .setTimestamp();
          await interaction.update({
            content: null,
            embeds: [declinedEmbed],
            components: [],
          });
          return;
        }
        const freshChallenger = getUserProfile(message.author.id);
        const freshChallenged = getUserProfile(victimId);
        if (
          freshChallenger.wallet < amount ||
          freshChallenged.wallet < amount
        ) {
          activeGames.delete(message.author.id);
          activeGames.delete(victimId);
          const errorEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              `❌ فشل بدء التحدي بسبب نقص الرصيد لدى أحد الطرفين.`,
            )
            .setTimestamp();
          await interaction.update({
            content: null,
            embeds: [errorEmbed],
            components: [],
          });
          return;
        }
        freshChallenger.wallet -= amount;
        freshChallenged.wallet -= amount;
        const preparingEmbed = new EmbedBuilder()
          .setColor(2829617)
          .setAuthor({
            name: message.author.username,
            iconURL: message.author.displayAvatarURL(),
          })
          .setDescription(
            [
              `| **تحدي**`,
              ``,
              `🟢 **تم قبول التحدي!**`,
              `جاري إجراء القرعة وتحديد الفائز عشوائياً... 🎲`,
            ].join("\n"),
          )
          .setTimestamp();
        await interaction.update({
          content: `<@${victimId}> - <@${message.author.id}>`,
          embeds: [preparingEmbed],
          components: [],
        });
        setTimeout(async () => {
          try {
            const isChallengerWinner = Math.random() < 0.5;
            const winnerId = isChallengerWinner ? message.author.id : victimId;
            const loserId = isChallengerWinner ? victimId : message.author.id;
            const winnerProfile = getUserProfile(winnerId);
            const pot = amount * 2;
            winnerProfile.wallet += pot;
            activeGames.delete(message.author.id);
            activeGames.delete(victimId);
            const resultEmbed = new EmbedBuilder()
              .setColor(65280)
              .setAuthor({
                name: message.author.username,
                iconURL: message.author.displayAvatarURL(),
              })
              .setDescription(
                [
                  `| **تحدي**`,
                  ``,
                  `🏆 **مبروك! فاز <@${winnerId}> في التحدي!**`,
                  `لقد ربح التحدي وحصل على الجائزة بعد إجراء القرعة.`,
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                  `💰 **الجائزة المحققة:** \`${pot.toLocaleString()} $\``,
                  `👛 **رصيد الفائز الجديد:** \`${winnerProfile.wallet.toLocaleString()} $\``,
                ].join("\n"),
              )
              .setTimestamp();
            if (guildIconUrl) {
              resultEmbed.setThumbnail(guildIconUrl);
            }
            await challengeMsg.edit({
              content: null,
              embeds: [resultEmbed],
              components: [],
            });
          } catch (err) {
            console.error("Error resolving challenge flip:", err);
            activeGames.delete(message.author.id);
            activeGames.delete(victimId);
          }
        }, 2e3);
      });
      challengeCollector.on("end", async (collected, reason) => {
        if (reason === "time") {
          activeGames.delete(message.author.id);
          activeGames.delete(victimId);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              `⏱️ **انتهت الـ 60 ثانية المتاحة للموافقة دون رد من <@${victimId}>.** تم إلغاء التحدي تلقائياً.`,
            )
            .setTimestamp();
          try {
            await challengeMsg.edit({
              content: null,
              embeds: [timeoutEmbed],
              components: [],
            });
          } catch (err) {
            console.error("Error editing challenge msg on timeout:", err);
          }
        }
      });
      return;
    }
    if (content === "وقت" || content === "وثت") {
      const guildIconUrl =
        message.guild.iconURL({ size: 256 }) ||
        client.user?.displayAvatarURL({ size: 256 });
      const commandsList = [
        { name: "عجلة", key: "عجلة" },
        { name: "الراتب", key: "الراتب" },
        { name: "استثمار", key: "استثمار" },
        { name: "تداول", key: "تداول" },
        { name: "شراء", key: "شراء" },
        { name: "بيع", key: "بيع" },
        { name: "ايموجي", key: "ايموجي" },
        { name: "رياضيات", key: "رياضيات" },
        { name: "لغز", key: "لغز" },
        { name: "زر", key: "زر" },
        { name: "تحدي", key: "تحدي" },
        { name: "لعبه", key: "game" },
        { name: "نهب", key: "نهب" },
        { name: "حماية", key: "حماية" },
        { name: "ممتلكات", key: "ممتلكات" },
        { name: "توب", key: "توب" },
      ];
      const lines = [];
      for (const cmd of commandsList) {
        const cmdKey = COMMAND_KEY_MAP[cmd.key] || cmd.key;
        const remainingMs = cooldownManager.getRemaining(cmdKey, message.author.id);
        let isCooldown = false;
        let remainingStr = "";
        if (remainingMs > 0) {
          isCooldown = true;
          const totalSeconds = remainingMs / 1e3;
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = Math.floor(totalSeconds % 60);
          const tenths = Math.floor((remainingMs % 1e3) / 100);
          remainingStr = ` : ${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
        }
        const circle = isCooldown ? "🔴" : "🟢";
        lines.push(`‏${circle} ${cmd.name}${remainingStr}`);
      }
      const embed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription([`| **وقت**`, ``, ...lines].join("\n"))
        .setTimestamp();
      if (guildIconUrl) {
        embed.setThumbnail(guildIconUrl);
      }
      await message.reply({ embeds: [embed] });
      return;
    }
    const lowerContent = content.toLowerCase();
    if (
      content === "توب" ||
      content === "توب الاثرياء" ||
      content === "توب الأثرياء" ||
      lowerContent === "top"
    ) {
      if (!(await checkCooldown(message.author.id, "توب", message))) return;
      const guildIconUrl = message.guild?.iconURL({ size: 256 }) || client.user?.displayAvatarURL({ size: 256 });
      const embed = buildTopEmbed(message.author.username, message.author.displayAvatarURL(), guildIconUrl);
      await message.reply({ embeds: [embed] });
      return;
    }
    if (
      content === "اسعار" ||
      content === "أسعار" ||
      content === "سوق" ||
      content === "متجر" ||
      content === "استفسار" ||
      lowerContent === "prices" ||
      lowerContent === "market" ||
      lowerContent === "inquiry"
    ) {
      const isEn = botLanguage === "en";
      const embed = getMarketEmbed(
        message.guild,
        message.author.username,
        message.author.displayAvatarURL(),
        botLanguage,
      );
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("prices_info_select")
        .setPlaceholder(isEn ? "Price Inquiry" : "استفسار عن أسعار المنتجات")
        .addOptions(
          marketItems.map((item) => ({
            label: isEn ? item.nameEn : item.name,
            value: item.id,
            emoji: item.emoji,
            description: isEn
              ? `Price inquiry for ${item.nameEn}`
              : `استفسار عن أسعار ${item.name}`,
          })),
        );
      const row = new ActionRowBuilder<any>().addComponents(selectMenu);
      const replyMsg = await message.reply({
        embeds: [embed],
        components: [row],
      });

      const filter = (i: any) =>
        i.customId === "prices_info_select" && i.user.id === message.author.id;
      const collector = replyMsg.createMessageComponentCollector({
        filter,
        time: 120000,
      });
      collector.on("collect", async (interaction) => {
        if (!interaction.isStringSelectMenu()) return;
        const selectedId = interaction.values[0];
        const item = marketItems.find((item2) => item2.id === selectedId);
        if (!item) return;
        const trend = getTrendEmoji(item, interaction.guild);
        const itemName = isEn ? item.nameEn : item.name;
        const infoEmbed = new EmbedBuilder()
          .setColor(2829617)
          .setAuthor({
            name: interaction.user.username,
            iconURL: interaction.user.displayAvatarURL(),
          })
          .setTitle(
            isEn
              ? `📈 Price Details: ${item.emoji} ${itemName}`
              : `📈 تفاصيل أسعار: ${item.emoji} ${itemName}`,
          )
          .setDescription(
            isEn
              ? [
                  `• **Current Price:** \`${item.currentPrice.toLocaleString("en-US")} $\` (${trend})`,
                  `• **Previous Price:** \`${item.lastPrice.toLocaleString("en-US")} $\``,
                  `• **Base Price:** \`${item.basePrice.toLocaleString("en-US")} $\``,
                  `• **Min Price:** \`${item.minPrice.toLocaleString("en-US")} $\``,
                  `• **Max Price:** \`${item.maxPrice.toLocaleString("en-US")} $\``,
                  `• **Max Purchase Limit:** \`${item.maxInventory.toLocaleString("en-US")} items\``,
                ].join("\n")
              : [
                  `• **السعر الحالي:** \`${item.currentPrice.toLocaleString()} $\` (${trend})`,
                  `• **السعر السابق:** \`${item.lastPrice.toLocaleString()} $\``,
                  `• **السعر الأساسي:** \`${item.basePrice.toLocaleString()} $\``,
                  `• **أدنى سعر:** \`${item.minPrice.toLocaleString()} $\``,
                  `• **أعلى سعر:** \`${item.maxPrice.toLocaleString()} $\``,
                  `• **الحد الأقصى للشراء:** \`${item.maxInventory.toLocaleString()} حبة\``,
                ].join("\n"),
          )
          .setTimestamp();
        await interaction.reply({ embeds: [infoEmbed], ephemeral: true });
      });
      collector.on("end", async () => {
        const disabledMenu = new StringSelectMenuBuilder()
          .setCustomId("prices_info_select_disabled")
          .setPlaceholder(
            isEn ? "Price Inquiry (Session Ended)" : "استفسار عن الأسعار (انتهت الجلسة)",
          )
          .setDisabled(true)
          .addOptions({
            label: isEn ? "Closed" : "مغلق",
            value: "closed",
          });
        const disabledRow = new ActionRowBuilder<any>().addComponents(
          disabledMenu,
        );
        try {
          await replyMsg.edit({ components: [disabledRow] });
        } catch (err) {}
      });
      return;
    }
    if (
      content === "حماية" ||
      content === "درع" ||
      content.startsWith("حماية") ||
      content.startsWith("درع")
    ) {
      if (!(await checkCooldown(message.author.id, "حماية", message))) return;

      const guildIconUrl =
        message.guild.iconURL({ size: 256 }) ||
        client.user?.displayAvatarURL({ size: 256 });

      const initialEmbed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setTitle("🛡️ شراء درع الحماية من النهب")
        .setDescription(
          [
            `اختر مدة الحماية المطلوبة من القائمة بالأسفل لحماية محفظتك من حوادث النهب والسرقة:`,
            ``,
            `• ⏱️ **دقيقة:** \`50,000 $\``,
            `• ⏰ **ساعة:** \`100,000 $\``,
            `• 📅 **يوم:** \`500,000 $\` (نصف مليون)`,
            `• 🗓️ **شهر:** \`1,000,000 $\` (مليون)`,
          ].join("\n"),
        )
        .setTimestamp();
      if (guildIconUrl) initialEmbed.setThumbnail(guildIconUrl);

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("shield_select_duration")
        .setPlaceholder("اختر مدة الحماية")
        .addOptions(
          {
            label: "دقيقة واحدة (1 Minute)",
            value: "minute",
            emoji: "⏱️",
            description: "السعر: 50,000 $",
          },
          {
            label: "ساعة واحدة (1 Hour)",
            value: "hour",
            emoji: "⏰",
            description: "السعر: 100,000 $",
          },
          {
            label: "يوم واحد (1 Day)",
            value: "day",
            emoji: "📅",
            description: "السعر: 500,000 $",
          },
          {
            label: "شهر كامل (1 Month)",
            value: "month",
            emoji: "🗓️",
            description: "السعر: 1,000,000 $",
          },
        );

      const selectRow = new ActionRowBuilder<any>().addComponents(selectMenu);
      const shieldMsg = await message.reply({
        embeds: [initialEmbed],
        components: [selectRow],
      });

      const filter = (i: any) => i.user.id === message.author.id;
      const collector = shieldMsg.createMessageComponentCollector({
        filter,
        time: 90000,
      });

      collector.on("collect", async (interaction) => {
        if (
          interaction.isStringSelectMenu() &&
          interaction.customId === "shield_select_duration"
        ) {
          const selectedValue = interaction.values[0];
          const durationDataMap: Record<
            string,
            { name: string; cost: number; ms: number }
          > = {
            minute: { name: "دقيقة واحدة", cost: 50000, ms: 60 * 1000 },
            hour: { name: "ساعة واحدة", cost: 100000, ms: 60 * 60 * 1000 },
            day: { name: "يوم واحد", cost: 500000, ms: 24 * 60 * 60 * 1000 },
            month: {
              name: "شهر كامل (30 يوم)",
              cost: 1000000,
              ms: 30 * 24 * 60 * 60 * 1000,
            },
          };

          const selectedData = durationDataMap[selectedValue];
          if (!selectedData) return;

          const confirmEmbed = new EmbedBuilder()
            .setColor(2829617)
            .setAuthor({
              name: interaction.user.username,
              iconURL: interaction.user.displayAvatarURL(),
            })
            .setTitle("🛡️ تأكيد شراء درع الحماية")
            .setDescription(
              [
                `أنت اخترت مدة الحماية: **${selectedData.name}**`,
                `تكلفة العملية المطلوبة: **${selectedData.cost.toLocaleString("en-US")} $**`,
                ``,
                `هل تريد إتمام عملية الدفع والتأمين أم الإلغاء؟`,
              ].join("\n"),
            )
            .setTimestamp();
          if (guildIconUrl) confirmEmbed.setThumbnail(guildIconUrl);

          const payBtn = new ButtonBuilder()
            .setCustomId(
              `shield_pay_${selectedData.cost}_${selectedData.ms}_${selectedValue}`,
            )
            .setLabel("دفع")
            .setStyle(ButtonStyle.Success);

          const cancelBtn = new ButtonBuilder()
            .setCustomId("shield_cancel")
            .setLabel("إلغاء")
            .setStyle(ButtonStyle.Danger);

          const buttonRow = new ActionRowBuilder<any>().addComponents(
            payBtn,
            cancelBtn,
          );

          await interaction.update({
            embeds: [confirmEmbed],
            components: [buttonRow],
          });
          return;
        }

        if (interaction.isButton()) {
          if (interaction.customId === "shield_cancel") {
            collector.stop("cancelled");
            const cancelEmbed = new EmbedBuilder()
              .setColor(16711680)
              .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL(),
              })
              .setDescription("❌ **تم إلغاء عملية شراء درع الحماية.**")
              .setTimestamp();

            await interaction.update({
              embeds: [cancelEmbed],
              components: [],
            });
            return;
          }

          if (interaction.customId.startsWith("shield_pay_")) {
            collector.stop("paid");
            const parts = interaction.customId.split("_");
            const cost = parseInt(parts[2], 10);
            const durationMs = parseInt(parts[3], 10);
            const selectedVal = parts[4];

            const durationNames: Record<string, string> = {
              minute: "دقيقة واحدة",
              hour: "ساعة واحدة",
              day: "يوم واحد",
              month: "شهر كامل (30 يوم)",
            };
            const durationName = durationNames[selectedVal] || "درع حماية";

            const profile = getUserProfile(interaction.user.id);
            if (profile.wallet < cost) {
              const errorEmbed = new EmbedBuilder()
                .setColor(16711680)
                .setAuthor({
                  name: interaction.user.username,
                  iconURL: interaction.user.displayAvatarURL(),
                })
                .setTitle("❌ فشلت عملية الدفع")
                .setDescription(
                  [
                    `عذراً، رصيدك في المحفظة غير كافٍ لإتمام هذه الصفقة!`,
                    `• **رصيدك الحالي:** \`${profile.wallet.toLocaleString("en-US")} $\``,
                    `• **التكلفة المطلوبة:** \`${cost.toLocaleString("en-US")} $\``,
                  ].join("\n"),
                )
                .setTimestamp();

              await interaction.update({
                embeds: [errorEmbed],
                components: [],
              });
              return;
            }

            profile.wallet -= cost;
            const now = Date.now();
            if (profile.shieldUntil && profile.shieldUntil > now) {
              profile.shieldUntil += durationMs;
            } else {
              profile.shieldUntil = now + durationMs;
            }

            const expireTimestamp = Math.floor(profile.shieldUntil / 1000);
            const successEmbed = new EmbedBuilder()
              .setColor(65280)
              .setAuthor({
                name: interaction.user.username,
                iconURL: interaction.user.displayAvatarURL(),
              })
              .setTitle("✅ تم تفعيل درع الحماية بنجاح!")
              .setDescription(
                [
                  `🛡️ **تم خصم المبلغ وتأمين حسابك ضد جميع عمليات النهب.**`,
                  ``,
                  `• **المدة المشتراة:** **${durationName}**`,
                  `• **المبلغ المخصوم:** \`${cost.toLocaleString("en-US")} $\``,
                  `• **وقت انتهاء الحماية:** <t:${expireTimestamp}:R>`,
                  `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                  `👛 **رصيدك المتبقي في المحفظة:** \`${profile.wallet.toLocaleString("en-US")} $\``,
                ].join("\n"),
              )
              .setTimestamp();
            if (guildIconUrl) successEmbed.setThumbnail(guildIconUrl);

            await interaction.update({
              embeds: [successEmbed],
              components: [],
            });
            return;
          }
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason !== "paid" && reason !== "cancelled") {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              "⏱️ **انتهت مهلة التفاعل.** تم إلغاء عملية شراء الحماية.",
            )
            .setTimestamp();

          try {
            await shieldMsg.edit({ embeds: [timeoutEmbed], components: [] });
          } catch (err) {}
        }
      });

      return;
    }

    if (content.startsWith("نهب")) {
      const match = content.match(/^نهب\s+(<@!?\d+>)$/);
      if (!match) {
        if (content === "نهب") {
          const guildIconUrl =
            message.guild.iconURL({ size: 256 }) ||
            client.user?.displayAvatarURL({ size: 256 });
          const embed = new EmbedBuilder()
            .setColor(2829617)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **نهب**`,
                ``,
                `**طريقة الاستخدام :**`,
                `\`نهب\` \`المنشن\``,
                `*(مثال: نهب @العضو)*`,
              ].join("\n"),
            )
            .setTimestamp();
          if (guildIconUrl) embed.setThumbnail(guildIconUrl);
          await message.reply({ embeds: [embed] });
        } else {
          await message.reply(
            "⚠️ **طريقة كتابة الأمر:** `نهب` `المنشن`\n*(مثال: نهب @العضو)*",
          );
        }
        return;
      }

      const victimId = match[1].replace(/[<@!>]/g, "");

      if (victimId === message.author.id) {
        await message.reply("❌ لا يمكنك نهب نفسك!");
        return;
      }

      const targetUser = message.mentions.users.get(victimId) || (await client.users.fetch(victimId).catch(() => null));
      if (victimId === client.user?.id || (targetUser && targetUser.bot)) {
        await message.reply("❌ لا يمكن نهب بوت!");
        return;
      }

      const victimProfile = getUserProfile(victimId);
      if (victimProfile.wallet <= 0) {
        await message.reply("❌ لا يمكن أن تنهبه، فهو لا يمتلك أموالاً في المحفظة!");
        return;
      }

      const now = Date.now();
      if (victimProfile.shieldUntil && victimProfile.shieldUntil > now) {
        const expireTimestamp = Math.floor(victimProfile.shieldUntil / 1000);
        await message.reply(
          `🛡️ **لا يمكنك نهب هذا العضو!** فهو ممتلك لدرع حماية نشط ينتهي <t:${expireTimestamp}:R>.`,
        );
        return;
      }

      if (!(await checkCooldown(message.author.id, "نهب", message))) return;

      const randomAmount = Math.floor(Math.random() * 501) + 500;
      const stolenAmount = Math.min(randomAmount, victimProfile.wallet);

      const robberProfile = getUserProfile(message.author.id);
      victimProfile.wallet -= stolenAmount;
      robberProfile.wallet += stolenAmount;

      const guildIconUrl =
        message.guild.iconURL({ size: 256 }) ||
        client.user?.displayAvatarURL({ size: 256 });
      const embed = new EmbedBuilder()
        .setColor(65280)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **نهب**`,
            ``,
            `🥷 **تمت عملية النهب بنجاح!**`,
            `لقد قمت بنهب <@${victimId}> وسرقة **${stolenAmount.toLocaleString()} $** من محفظته!`,
            `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
            `👛 **رصيد محفظتك الجديد:** \`${robberProfile.wallet.toLocaleString()} $\``,
          ].join("\n"),
        )
        .setTimestamp();
      if (guildIconUrl) embed.setThumbnail(guildIconUrl);
      await message.reply({ embeds: [embed] });
      return;
    }
    if (content.startsWith("شراء")) {
      const buyMatch = content.match(/^شراء\s+(\d+)$/);
      if (!buyMatch) {
        await message.reply(
          "⚠️ **طريقة كتابة الأمر:** `شراء` `العدد`\n*(مثال: شراء 5)*",
        );
        return;
      }
      const qty = parseInt(buyMatch[1], 10);
      if (isNaN(qty) || qty <= 0) {
        await message.reply("❌ الرجاء كتابة كمية صحيحة وأكبر من الصفر.");
        return;
      }
      if (activeSessions.has(message.author.id)) {
        await message.reply(
          "⚠️ **لديك عملية شراء أو بيع معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }
      if (!(await checkCooldown(message.author.id, "شراء", message))) return;
      activeSessions.add(message.author.id);
      const embed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [`| **شراء**`, ``, `اختر من القائمة بالأسفل`].join("\n"),
        )
        .setTimestamp();
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("buy_select_item")
        .setPlaceholder("اختر المنتج")
        .addOptions(
          marketItems.map((item) => ({
            label: item.name,
            value: item.id,
            emoji: item.emoji,
            description: `السعر الحالي: ${item.currentPrice.toLocaleString()} $`,
          })),
        );
      const cancelBtn = new ButtonBuilder()
        .setCustomId("buy_cancel")
        .setLabel("إلغاء")
        .setStyle(ButtonStyle.Danger);
      const selectRow = new ActionRowBuilder<any>().addComponents(
        selectMenu,
      );
      const btnRow = new ActionRowBuilder<any>().addComponents(
        cancelBtn,
      );
      const responseMsg = await message.reply({
        embeds: [embed],
        components: [selectRow, btnRow],
      });
      const filter = (i: any) =>
        (i.customId === "buy_select_item" || i.customId === "buy_cancel") &&
        i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        time: 60000,
      });
      collector.on("collect", async (interaction) => {
        if (interaction.customId === "buy_cancel") {
          collector.stop("cancelled");
          activeSessions.delete(message.author.id);
          const cancelEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription("❌ **تم إلغاء عملية الشراء.**")
            .setTimestamp();
          await interaction.update({ embeds: [cancelEmbed], components: [] });
          return;
        }
        if (!interaction.isStringSelectMenu()) return;
        const selectedId = interaction.values[0];
        const selectedItem = marketItems.find((item) => item.id === selectedId);
        if (!selectedItem) {
          activeSessions.delete(message.author.id);
          collector.stop();
          await interaction.reply({
            content: "❌ حدث خطأ، لم يتم العثور على العنصر.",
            ephemeral: true,
          });
          return;
        }
        collector.stop("selected");
        const profile = getUserProfile(message.author.id);
        const totalCost = selectedItem.currentPrice * qty;
        const currentQty = profile.inventory[selectedItem.id] || 0;
        if (profile.wallet < totalCost) {
          activeSessions.delete(message.author.id);
          const errorEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("❌ فشلت عملية الشراء")
            .setDescription(
              `عذراً، رصيدك في المحفظة غير كافٍ لإتمام هذه الصفقة.`,
            )
            .addFields(
              {
                name: "👛 رصيدك الحالي",
                value: `\`${profile.wallet.toLocaleString()} $\``,
                inline: true,
              },
              {
                name: "💸 التكلفة المطلوبة",
                value: `\`${totalCost.toLocaleString()} $\``,
                inline: true,
              },
            )
            .setTimestamp();
          await interaction.update({ embeds: [errorEmbed], components: [] });
          return;
        }
        if (currentQty + qty > selectedItem.maxInventory) {
          activeSessions.delete(message.author.id);
          const errorEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("❌ تجاوز الحد الأقصى للمخزون")
            .setDescription(
              `لا يمكنك امتلاك أكثر من **${selectedItem.maxInventory.toLocaleString()} حبة** من هذا العنصر.`,
            )
            .addFields(
              {
                name: "📦 مخزونك الحالي",
                value: `\`${currentQty} / ${selectedItem.maxInventory}\``,
                inline: true,
              },
              {
                name: "🔢 إجمالي الشحنة الجديدة",
                value: `\`${currentQty + qty} / ${selectedItem.maxInventory}\``,
                inline: true,
              },
            )
            .setTimestamp();
          await interaction.update({ embeds: [errorEmbed], components: [] });
          return;
        }
        const balanceBefore = profile.wallet;
        profile.wallet -= totalCost;
        profile.inventory[selectedItem.id] = currentQty + qty;
        activeSessions.delete(message.author.id);
        const successEmbed = new EmbedBuilder()
          .setColor(65280)
          .setAuthor({
            name: message.author.username,
            iconURL: message.author.displayAvatarURL(),
          })
          .setTitle("✅ تمت عملية الشراء بنجاح!")
          .setDescription(
            `لقد قمت بإتمام الصفقة بنجاح عبر **Fire Bank** بالأسعار الحالية للسوق العالمي.

━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          )
          .addFields(
            {
              name: "📦 العنصر المطلوب",
              value: `\`${selectedItem.emoji} ${selectedItem.name} \xD7 ${qty.toLocaleString()} حبة\``,
              inline: false,
            },
            {
              name: "💰 سعر الوحدة الحالي",
              value: `\`${selectedItem.currentPrice.toLocaleString()} $\``,
              inline: true,
            },
            {
              name: "💸 إجمالي تكلفة الصفقة",
              value: `\`${totalCost.toLocaleString()} $\``,
              inline: true,
            },
            {
              name: "💳 رصيدك قبل الشراء",
              value: `\`${balanceBefore.toLocaleString()} $\``,
              inline: false,
            },
            {
              name: "👛 رصيدك الحالي بعد شراء العناصر",
              value: `\`${profile.wallet.toLocaleString()} $\``,
              inline: false,
            },
          )
          .setFooter({ text: "شكراً لتعاملك مع سوق فاير بانك المالي" })
          .setTimestamp();
        await interaction.update({ embeds: [successEmbed], components: [] });
      });
      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          activeSessions.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("❌ انتهى وقت الجلسة")
            .setDescription(
              "انتهت الـ 60 ثانية دون اختيار السلعة. تم إلغاء عملية الشراء تلقائياً.",
            )
            .setTimestamp();
          await responseMsg.edit({ embeds: [timeoutEmbed], components: [] });
        }
      });
      return;
    }
    if (content.startsWith("بيع")) {
      const sellMatch = content.match(/^بيع\s+(\d+)$/);
      if (!sellMatch) {
        await message.reply(
          "⚠️ **طريقة كتابة الأمر:** `بيع` `العدد`\n*(مثال: بيع 3)*",
        );
        return;
      }
      const qty = parseInt(sellMatch[1], 10);
      if (isNaN(qty) || qty <= 0) {
        await message.reply("❌ الرجاء كتابة كمية صحيحة وأكبر من الصفر.");
        return;
      }
      if (activeSessions.has(message.author.id)) {
        await message.reply(
          "⚠️ **لديك عملية شراء أو بيع معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }
      if (!(await checkCooldown(message.author.id, "بيع", message))) return;
      activeSessions.add(message.author.id);
      const embed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription([`| **بيع**`, ``, `اختر من القائمة بالأسفل`].join("\n"))
        .setTimestamp();
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("sell_select_item")
        .setPlaceholder("اختر المنتج")
        .addOptions(
          marketItems.map((item) => ({
            label: item.name,
            value: item.id,
            emoji: item.emoji,
            description: `السعر الحالي: ${item.currentPrice.toLocaleString()} $`,
          })),
        );
      const cancelBtn = new ButtonBuilder()
        .setCustomId("sell_cancel")
        .setLabel("إلغاء")
        .setStyle(ButtonStyle.Danger);
      const selectRow = new ActionRowBuilder<any>().addComponents(
        selectMenu,
      );
      const btnRow = new ActionRowBuilder<any>().addComponents(
        cancelBtn,
      );
      const responseMsg = await message.reply({
        embeds: [embed],
        components: [selectRow, btnRow],
      });
      const filter = (i: any) =>
        (i.customId === "sell_select_item" || i.customId === "sell_cancel") &&
        i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        time: 60000,
      });
      collector.on("collect", async (interaction) => {
        if (interaction.customId === "sell_cancel") {
          collector.stop("cancelled");
          activeSessions.delete(message.author.id);
          const cancelEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription("❌ **تم إلغاء عملية البيع.**")
            .setTimestamp();
          await interaction.update({ embeds: [cancelEmbed], components: [] });
          return;
        }
        if (!interaction.isStringSelectMenu()) return;
        const selectedId = interaction.values[0];
        const selectedItem = marketItems.find((item) => item.id === selectedId);
        if (!selectedItem) {
          activeSessions.delete(message.author.id);
          collector.stop();
          await interaction.reply({
            content: "❌ حدث خطأ، لم يتم العثور على العنصر.",
            ephemeral: true,
          });
          return;
        }
        collector.stop("selected");
        const profile = getUserProfile(message.author.id);
        const currentQty = profile.inventory[selectedItem.id] || 0;
        if (currentQty < qty) {
          activeSessions.delete(message.author.id);
          const errorEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("❌ أنت لا تمتلك عدد كافي")
            .setDescription(
              `عذراً، أنت لا تمتلك الكمية الكافية من هذا العنصر لإتمام البيع.`,
            )
            .addFields(
              {
                name: "📦 مخزونك الحالي",
                value: `\`${currentQty} / 100\``,
                inline: true,
              },
              {
                name: "🔢 الكمية المطلوبة للبيع",
                value: `\`${qty}\``,
                inline: true,
              },
            )
            .setTimestamp();
          await interaction.update({ embeds: [errorEmbed], components: [] });
          return;
        }
        const totalEarnings = selectedItem.currentPrice * qty;
        const balanceBefore = profile.wallet;
        profile.wallet += totalEarnings;
        profile.inventory[selectedItem.id] = currentQty - qty;
        activeSessions.delete(message.author.id);
        const successEmbed = new EmbedBuilder()
          .setColor(65280)
          .setAuthor({
            name: message.author.username,
            iconURL: message.author.displayAvatarURL(),
          })
          .setTitle("✅ تمت عملية البيع بنجاح!")
          .setDescription(
            `لقد قمت بإتمام صفقة البيع بنجاح عبر **Fire Bank** بالأسعار الحالية للسوق العالمي.

━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          )
          .addFields(
            {
              name: "📦 العنصر المبيع",
              value: `\`${selectedItem.emoji} ${selectedItem.name} \xD7 ${qty.toLocaleString()} حبة\``,
              inline: false,
            },
            {
              name: "💰 سعر الوحدة الحالي",
              value: `\`${selectedItem.currentPrice.toLocaleString()} $\``,
              inline: true,
            },
            {
              name: "💸 إجمالي أرباح الصفقة",
              value: `\`${totalEarnings.toLocaleString()} $\``,
              inline: true,
            },
            {
              name: "💳 رصيدك قبل البيع",
              value: `\`${balanceBefore.toLocaleString()} $\``,
              inline: false,
            },
            {
              name: "👛 رصيدك الحالي بعد بيع العناصر",
              value: `\`${profile.wallet.toLocaleString()} $\``,
              inline: false,
            },
          )
          .setFooter({ text: "شكراً لتعاملك مع سوق فاير بانك المالي" })
          .setTimestamp();
        await interaction.update({ embeds: [successEmbed], components: [] });
      });
      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          activeSessions.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("❌ انتهى وقت الجلسة")
            .setDescription(
              "انتهت الـ 60 ثانية دون اختيار السلعة. تم إلغاء عملية البيع تلقائياً.",
            )
            .setTimestamp();
          await responseMsg.edit({ embeds: [timeoutEmbed], components: [] });
        }
      });
      return;
    }
    if (content === "الراتب") {
      if (
        activeGames.has(message.author.id) ||
        activeSessions.has(message.author.id)
      ) {
        await message.reply(
          "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }
      if (!(await checkCooldown(message.author.id, "الراتب", message))) return;
      activeGames.add(message.author.id);
      const numberSet = new Set<number>();
      while (numberSet.size < 9) {
        numberSet.add(Math.floor(Math.random() * 99) + 1);
      }
      const numbers = Array.from(numberSet);
      const sortedNumbers = [...numbers].sort((a, b) => a - b);
      const rows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder<any>();
        for (let j = 0; j < 3; j++) {
          const num = numbers[i * 3 + j];
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`salary_num_${num}`)
              .setLabel(num.toString())
              .setStyle(ButtonStyle.Secondary),
          );
        }
        rows.push(row);
      }
      const salaryEmbed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **الراتب**`,
            ``,
            `يجب عليك ترتيب الاعداد تصاعدياً في 60 ثانية`,
            `في حال الفشل لن يتم ايداع مبلغ الراتب الى حسابك`,
          ].join("\n"),
        )
        .setTimestamp();
      const responseMsg = await message.reply({
        embeds: [salaryEmbed],
        components: rows,
      });
      const filter = (i: any) =>
        i.customId.startsWith("salary_num_") && i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        time: 60000,
      });
      let nextIndex = 0;
      const clickedNumbers = new Set();
      collector.on("collect", async (interaction) => {
        if (!interaction.isButton()) return;
        const clickedNum = parseInt(
          interaction.customId.replace("salary_num_", ""),
          10,
        );
        const expectedNum = sortedNumbers[nextIndex];
        if (clickedNum === expectedNum) {
          clickedNumbers.add(clickedNum);
          nextIndex++;
          if (nextIndex === 9) {
            collector.stop("win");
            const profile = getUserProfile(message.author.id);
            const reward = 5e4;
            profile.wallet += reward;
            activeGames.delete(message.author.id);
            const winRows = [];
            for (let i = 0; i < 3; i++) {
              const row = new ActionRowBuilder<any>();
              for (let j = 0; j < 3; j++) {
                const num = numbers[i * 3 + j];
                row.addComponents(
                  new ButtonBuilder()
                    .setCustomId(`salary_win_${num}`)
                    .setLabel(num.toString())
                    .setStyle(ButtonStyle.Success)
                    .setDisabled(true),
                );
              }
              winRows.push(row);
            }
            const successEmbed = new EmbedBuilder()
              .setColor(65280)
              .setAuthor({
                name: message.author.username,
                iconURL: message.author.displayAvatarURL(),
              })
              .setDescription(
                [
                  `| **الراتب**`,
                  ``,
                  `🏆 **تهانينا! لقد نجحت في ترتيب الأعداد تصاعدياً.**`,
                  `💰 **تم إيداع مبلغ الراتب:** \`50,000 $\` في محفظتك.`,
                  `👛 **رصيد محفظتك الجديد:** \`${profile.wallet.toLocaleString()} $\``,
                ].join("\n"),
              )
              .setTimestamp();
            await interaction.update({
              embeds: [successEmbed],
              components: winRows,
            });
          } else {
            const currentRows = [];
            for (let i = 0; i < 3; i++) {
              const row = new ActionRowBuilder<any>();
              for (let j = 0; j < 3; j++) {
                const num = numbers[i * 3 + j];
                const isClicked = clickedNumbers.has(num);
                row.addComponents(
                  new ButtonBuilder()
                    .setCustomId(`salary_num_${num}`)
                    .setLabel(num.toString())
                    .setStyle(
                      isClicked ? ButtonStyle.Success : ButtonStyle.Secondary,
                    )
                    .setDisabled(isClicked),
                );
              }
              currentRows.push(row);
            }
            await interaction.update({ components: currentRows });
          }
        } else {
          collector.stop("fail_wrong");
          activeGames.delete(message.author.id);
          const failRows = [];
          for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder<any>();
            for (let j = 0; j < 3; j++) {
              const num = numbers[i * 3 + j];
              const isClicked = clickedNumbers.has(num);
              const isWrong = num === clickedNum;
              let style = ButtonStyle.Secondary;
              if (isClicked) style = ButtonStyle.Success;
              if (isWrong) style = ButtonStyle.Danger;
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`salary_fail_${num}`)
                  .setLabel(num.toString())
                  .setStyle(style)
                  .setDisabled(true),
              );
            }
            failRows.push(row);
          }
          const failEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **الراتب**`,
                ``,
                `❌ **فشل الحصول على الراتب!**`,
                `لقد قمت باختيار عدد خاطئ. ترتيب الأعداد كان يجب أن يكون تصاعدياً.`,
              ].join("\n"),
            )
            .setTimestamp();
          await interaction.update({
            embeds: [failEmbed],
            components: failRows,
          });
        }
      });
      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          activeGames.delete(message.author.id);
          const timeoutRows = [];
          for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder<any>();
            for (let j = 0; j < 3; j++) {
              const num = numbers[i * 3 + j];
              const isClicked = clickedNumbers.has(num);
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`salary_timeout_${num}`)
                  .setLabel(num.toString())
                  .setStyle(
                    isClicked ? ButtonStyle.Success : ButtonStyle.Secondary,
                  )
                  .setDisabled(true),
              );
            }
            timeoutRows.push(row);
          }
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **الراتب**`,
                ``,
                `⏱️ **انتهى الوقت (60 ثانية) دون إكمال ترتيب الأعداد!**`,
                `تم إلغاء عملية صرف الراتب لعدم السرعة الكافية.`,
              ].join("\n"),
            )
            .setTimestamp();
          try {
            await responseMsg.edit({
              embeds: [timeoutEmbed],
              components: timeoutRows,
            });
          } catch (err) {
            console.error("Error editing salary msg on timeout:", err);
          }
        }
      });
      return;
    }

    // Command: لعبة / لعبه (Rock - Paper - Scissors)
    if (content === "لعبه" || content === "لعبة") {
      if (
        activeGames.has(message.author.id) ||
        activeSessions.has(message.author.id)
      ) {
        await message.reply(
          "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }

      if (!(await checkCooldown(message.author.id, "game", message))) return;

      activeGames.add(message.author.id);

      const rpsEmbed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **لعبة**`,
            ``,
            `حجرة - ورقة - مقص`,
            `في حال الفوز سيتم اضافة 2000 $ الى رصيدك`,
            `في حال التعادل والخسارة لن يتم اضافة او خصم المبلغ من رصيدك`,
          ].join("\n"),
        )
        .setTimestamp();

      const rockBtn = new ButtonBuilder()
        .setCustomId("rps_rock")
        .setEmoji("🧱")
        .setStyle(ButtonStyle.Secondary);
      const paperBtn = new ButtonBuilder()
        .setCustomId("rps_paper")
        .setEmoji("📄")
        .setStyle(ButtonStyle.Secondary);
      const scissorsBtn = new ButtonBuilder()
        .setCustomId("rps_scissors")
        .setEmoji("✂️")
        .setStyle(ButtonStyle.Secondary);

      const row = new ActionRowBuilder<any>().addComponents(
        rockBtn,
        paperBtn,
        scissorsBtn,
      );

      const responseMsg = await message.reply({
        embeds: [rpsEmbed],
        components: [row],
      });

      const filter = (i: any) =>
        (i.customId === "rps_rock" ||
          i.customId === "rps_paper" ||
          i.customId === "rps_scissors") &&
        i.user.id === message.author.id;

      const collector = responseMsg.createMessageComponentCollector({
        filter,
        time: 60000,
      });

      collector.on("collect", async (interaction) => {
        if (!interaction.isButton()) return;

        collector.stop("played");
        activeGames.delete(message.author.id);

        let userChoice: "rock" | "paper" | "scissors" = "rock";
        if (interaction.customId === "rps_paper") userChoice = "paper";
        if (interaction.customId === "rps_scissors") userChoice = "scissors";

        // Determine outcome target:
        // Bot Win: 51% (roll < 0.51)
        // User Win: 48.9% (0.51 <= roll < 0.999)
        // Draw: 0.1% (roll >= 0.999)
        const roll = Math.random();
        let targetOutcome: "BOT_WIN" | "USER_WIN" | "DRAW";
        if (roll < 0.51) {
          targetOutcome = "BOT_WIN";
        } else if (roll < 0.999) {
          targetOutcome = "USER_WIN";
        } else {
          targetOutcome = "DRAW";
        }

        let botChoice: "rock" | "paper" | "scissors" = "rock";

        if (userChoice === "rock") {
          if (targetOutcome === "BOT_WIN") botChoice = "paper";
          else if (targetOutcome === "USER_WIN") botChoice = "scissors";
          else botChoice = "rock";
        } else if (userChoice === "paper") {
          if (targetOutcome === "BOT_WIN") botChoice = "scissors";
          else if (targetOutcome === "USER_WIN") botChoice = "rock";
          else botChoice = "paper";
        } else {
          // scissors
          if (targetOutcome === "BOT_WIN") botChoice = "rock";
          else if (targetOutcome === "USER_WIN") botChoice = "paper";
          else botChoice = "scissors";
        }

        const emojiMap = {
          rock: "🧱",
          paper: "📄",
          scissors: "✂️",
        };

        const userEmoji = emojiMap[userChoice];
        const botEmoji = emojiMap[botChoice];

        const endRow = new ActionRowBuilder<any>().addComponents(
          new ButtonBuilder()
            .setCustomId("rps_end_rock")
            .setEmoji("🧱")
            .setStyle(userChoice === "rock" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("rps_end_paper")
            .setEmoji("📄")
            .setStyle(userChoice === "paper" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(true),
          new ButtonBuilder()
            .setCustomId("rps_end_scissors")
            .setEmoji("✂️")
            .setStyle(userChoice === "scissors" ? ButtonStyle.Primary : ButtonStyle.Secondary)
            .setDisabled(true),
        );

        if (targetOutcome === "USER_WIN") {
          const profile = getUserProfile(message.author.id);
          profile.wallet += 2000;

          const winEmbed = new EmbedBuilder()
            .setColor(65280)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **لعبة**`,
                ``,
                `🎉 **مبروك! لقد فزت في اللعبة!**`,
                `اختيارك: ${userEmoji}  |  اختيار البوت: ${botEmoji}`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `💰 **تم إضافة الجائزة:** \`2,000 $\` إلى رصيدك.`,
                `👛 **رصيدك الجديد في المحفظة:** \`${profile.wallet.toLocaleString()} $\``,
              ].join("\n"),
            )
            .setTimestamp();

          await interaction.update({
            embeds: [winEmbed],
            components: [endRow],
          });
        } else if (targetOutcome === "BOT_WIN") {
          const botWinEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **لعبة**`,
                ``,
                `🤖 **لقد فزت**`,
                `اختيارك: ${userEmoji}  |  اختيار البوت: ${botEmoji}`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `خيرها بغيرها! حاول مرة أخرى بعد انتهاء مدة الانتظار.`,
              ].join("\n"),
            )
            .setTimestamp();

          await interaction.update({
            embeds: [botWinEmbed],
            components: [endRow],
          });
        } else {
          // DRAW
          const drawEmbed = new EmbedBuilder()
            .setColor(16776960)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **لعبة**`,
                ``,
                `⚖️ **تعادل ☹️**`,
                `اختيارك: ${userEmoji}  |  اختيار البوت: ${botEmoji}`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `انتهت اللعبة بالتعادل دون تغيير في الرصيد.`,
              ].join("\n"),
            )
            .setTimestamp();

          await interaction.update({
            embeds: [drawEmbed],
            components: [endRow],
          });
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          activeGames.delete(message.author.id);
          const timeoutRow = new ActionRowBuilder<any>().addComponents(
            new ButtonBuilder().setCustomId("rps_t_rock").setEmoji("🧱").setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId("rps_t_paper").setEmoji("📄").setStyle(ButtonStyle.Secondary).setDisabled(true),
            new ButtonBuilder().setCustomId("rps_t_scissors").setEmoji("✂️").setStyle(ButtonStyle.Secondary).setDisabled(true),
          );
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **لعبة**`,
                ``,
                `⏱️ **انتهت الـ 60 ثانية المتاحة دون اختيار!** تم إلغاء اللعبة.`,
              ].join("\n"),
            )
            .setTimestamp();

          try {
            await responseMsg.edit({
              embeds: [timeoutEmbed],
              components: [timeoutRow],
            });
          } catch (err) {
            console.error("Error editing rps msg on timeout:", err);
          }
        }
      });
      return;
    }



    // Command: رياضيات
    if (content === "رياضيات") {
      if (
        activeGames.has(message.author.id) ||
        activeSessions.has(message.author.id)
      ) {
        await message.reply(
          "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }

      if (!(await checkCooldown(message.author.id, "رياضيات", message))) return;

      activeGames.add(message.author.id);

      // Generate operator: mostly + and -, sometimes *
      const rand = Math.random();
      let num1 = 0;
      let num2 = 0;
      let correctAnswer = 0;
      let opSymbol = "+";

      if (rand < 0.45) {
        num1 = Math.floor(Math.random() * 99) + 2; // 2 to 100
        num2 = Math.floor(Math.random() * 99) + 2;
        correctAnswer = num1 + num2;
        opSymbol = "+";
      } else if (rand < 0.90) {
        const n1 = Math.floor(Math.random() * 99) + 2;
        const n2 = Math.floor(Math.random() * 99) + 2;
        num1 = Math.max(n1, n2);
        num2 = Math.min(n1, n2);
        correctAnswer = num1 - num2;
        opSymbol = "-";
      } else {
        num1 = Math.floor(Math.random() * 11) + 2; // 2 to 12
        num2 = Math.floor(Math.random() * 11) + 2;
        correctAnswer = num1 * num2;
        opSymbol = "×";
      }

      // Generate 4 unique choices (1 correct, 3 fake close to the correct one)
      const choicesSet = new Set<number>([correctAnswer]);
      while (choicesSet.size < 4) {
        const offset = Math.floor(Math.random() * 21) - 10; // -10 to +10
        const fakeVal = correctAnswer + offset;
        if (fakeVal !== correctAnswer && fakeVal > 0) {
          choicesSet.add(fakeVal);
        }
      }
      const choices = Array.from(choicesSet);
      // Shuffle choices
      for (let i = choices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [choices[i], choices[j]] = [choices[j], choices[i]];
      }

      const row = new ActionRowBuilder<any>();
      for (let i = 0; i < 4; i++) {
        row.addComponents(
          new ButtonBuilder()
            .setCustomId(`math_choice_${choices[i]}`)
            .setLabel(choices[i].toString())
            .setStyle(ButtonStyle.Primary),
        );
      }

      const mathEmbed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `> **رياضيات**`,
            ``,
            `حل المسألة الرياضية التالية لتحصل على الجائزة!`,
            ``,
            `# **${num1} ${opSymbol} ${num2} = ؟**`,
            ``,
            `لديك **10** ثوانٍ للاختيار! ⏱️`,
          ].join("\n"),
        )
        .setTimestamp();

      const responseMsg = await message.reply({ embeds: [mathEmbed], components: [row] });

      const filter = (i: any) =>
        i.customId.startsWith("math_choice_") && i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        time: 10000,
      });

      let gameEnded = false;

      collector.on("collect", async (interaction) => {
        if (!interaction.isButton()) return;
        gameEnded = true;
        collector.stop("guessed");

        const chosenVal = parseInt(
          interaction.customId.replace("math_choice_", ""),
          10,
        );
        const profile = getUserProfile(message.author.id);
        activeGames.delete(message.author.id);

        const endRow = new ActionRowBuilder<any>();
        for (let i = 0; i < 4; i++) {
          const val = choices[i];
          const btn = new ButtonBuilder()
            .setCustomId(`math_end_${val}`)
            .setLabel(val.toString())
            .setDisabled(true);

          if (val === correctAnswer) {
            btn.setStyle(ButtonStyle.Success);
          } else if (val === chosenVal) {
            btn.setStyle(ButtonStyle.Danger);
          } else {
            btn.setStyle(ButtonStyle.Secondary);
          }
          endRow.addComponents(btn);
        }

        if (chosenVal === correctAnswer) {
          const reward = Math.floor(Math.random() * 4001) + 1000;
          profile.wallet += reward;

          const winEmbed = new EmbedBuilder()
            .setColor(0x00ff00)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **رياضيات**`,
                ``,
                `🏆 **إجابة صحيحة وممتازة!**`,
                `السؤال: **${num1} ${opSymbol} ${num2} = ${correctAnswer}**`,
                `💰 **تم إضافة الجائزة:** \`${reward.toLocaleString()} $\` في محفظتك.`,
                `👛 **رصيد محفظتك الجديد:** \`${profile.wallet.toLocaleString()} $\``,
              ].join("\n"),
            )
            .setTimestamp();

          await interaction.update({ embeds: [winEmbed], components: [endRow] });
        } else {
          const failEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **رياضيات**`,
                ``,
                `❌ **إجابة خاطئة! للأسف.**`,
                `الإجابة الصحيحة كانت: **${correctAnswer}**`,
              ].join("\n"),
            )
            .setTimestamp();

          await interaction.update({ embeds: [failEmbed], components: [endRow] });
        }
      });

      collector.on("end", async (collected, reason) => {
        if (reason === "time" && !gameEnded) {
          activeGames.delete(message.author.id);

          const timeoutRow = new ActionRowBuilder<any>();
          for (let i = 0; i < 4; i++) {
            const val = choices[i];
            const btn = new ButtonBuilder()
              .setCustomId(`math_end_${val}`)
              .setLabel(val.toString())
              .setDisabled(true);

            if (val === correctAnswer) {
              btn.setStyle(ButtonStyle.Success);
            } else {
              btn.setStyle(ButtonStyle.Secondary);
            }
            timeoutRow.addComponents(btn);
          }

          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xff0000)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **رياضيات**`,
                ``,
                `⏱️ **انتهى الوقت (10 ثوانٍ) دون إجابة!**`,
                `الإجابة الصحيحة كانت: **${correctAnswer}**`,
              ].join("\n"),
            )
            .setTimestamp();

          try {
            await responseMsg.edit({ embeds: [timeoutEmbed], components: [timeoutRow] });
          } catch (err) {
            console.error("Error sending math timeout msg:", err);
          }
        }
      });

      return;
    }

    // Command: عجلة (Wheel of Fortune)
    if (
      content === "عجلة" ||
      content === "عجله" ||
      content === "wheel" ||
      content === "/عجلة" ||
      content === "/wheel" ||
      content === "عاجل" ||
      content === "ajil"
    ) {
      if (!(await checkCooldown(message.author.id, "عجلة", message))) return;
      await handleWheelCommand(message);
      return;
    }

    // Command: لغز
    if (content === "لغز" || content === "riddle") {
      if (!(await checkCooldown(message.author.id, "لغز", message))) return;

      if (
        activeGames.has(message.author.id) ||
        activeSessions.has(message.author.id)
      ) {
        await message.reply(
          "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }

      activeGames.add(message.author.id);

      const loadingEmbed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription("🔮 **جاري تحضير اللغز بواسطة الذكاء الاصطناعي...** ⏱️")
        .setTimestamp();

      const responseMsg = await message.reply({ embeds: [loadingEmbed] });

      try {
        const riddleData = await openRouterService.generateRiddle();
        const profile = getUserProfile(message.author.id);

        // Calculate dynamic reward based inversely on user total wealth (wallet + bank)
        const totalWealth = profile.wallet + profile.bank;
        // Formula: wealth 0 => ~10,000$, wealth 1,000,000$+ => ~1,000$
        let baseReward = Math.round(10000 - Math.min(1, Math.max(0, totalWealth) / 1000000) * 9000);
        const variance = Math.floor(Math.random() * 1001) - 500; // -500 to +500
        const reward = Math.max(1000, Math.min(10000, baseReward + variance));

        const row = new ActionRowBuilder<any>();
        for (let i = 0; i < riddleData.options.length; i++) {
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`riddle_choice_${i}`)
              .setLabel(`${i + 1}. ${riddleData.options[i]}`)
              .setStyle(ButtonStyle.Primary),
          );
        }

        const riddleEmbed = new EmbedBuilder()
          .setColor(0x2b2d31)
          .setAuthor({
            name: message.author.username,
            iconURL: message.author.displayAvatarURL(),
          })
          .setDescription(
            [
              `| **لغز** 🧩`,
              ``,
              `**${riddleData.question}**`,
              ``,
              `💰 **الجائزة المتوقعة:** \`${reward.toLocaleString()} $\` *(تعتمد على رصيدك)*`,
              `⏱️ **لديك 30 ثانية للإجابة!**`,
            ].join("\n"),
          )
          .setTimestamp();

        await responseMsg.edit({ embeds: [riddleEmbed], components: [row] });

        const filter = (i: any) =>
          i.customId.startsWith("riddle_choice_") && i.user.id === message.author.id;
        const collector = responseMsg.createMessageComponentCollector({
          filter,
          time: 30000,
        });

        let gameEnded = false;

        collector.on("collect", async (interaction) => {
          if (!interaction.isButton()) return;
          gameEnded = true;
          collector.stop("guessed");

          const chosenIdx = parseInt(
            interaction.customId.replace("riddle_choice_", ""),
            10,
          );
          activeGames.delete(message.author.id);

          const endRow = new ActionRowBuilder<any>();
          for (let i = 0; i < riddleData.options.length; i++) {
            const btn = new ButtonBuilder()
              .setCustomId(`riddle_end_${i}`)
              .setLabel(`${i + 1}. ${riddleData.options[i]}`)
              .setDisabled(true);

            if (i === riddleData.correctIndex) {
              btn.setStyle(ButtonStyle.Success);
            } else if (i === chosenIdx) {
              btn.setStyle(ButtonStyle.Danger);
            } else {
              btn.setStyle(ButtonStyle.Secondary);
            }
            endRow.addComponents(btn);
          }

          if (chosenIdx === riddleData.correctIndex) {
            profile.wallet += reward;

            const winEmbed = new EmbedBuilder()
              .setColor(0x00ff00)
              .setAuthor({
                name: message.author.username,
                iconURL: message.author.displayAvatarURL(),
              })
              .setDescription(
                [
                  `| **لغز** 🧩`,
                  ``,
                  `🏆 **إجابة صحيحة وممتازة!**`,
                  `اللغز: **${riddleData.question}**`,
                  `الإجابة: **${riddleData.options[riddleData.correctIndex]}**`,
                  ``,
                  `💰 **تم إضافة الجائزة:** \`${reward.toLocaleString()} $\` في محفظتك.`,
                  `👛 **رصيد محفظتك الجديد:** \`${profile.wallet.toLocaleString()} $\``,
                ].join("\n"),
              )
              .setTimestamp();

            await interaction.update({ embeds: [winEmbed], components: [endRow] });
          } else {
            const failEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setAuthor({
                name: message.author.username,
                iconURL: message.author.displayAvatarURL(),
              })
              .setDescription(
                [
                  `| **لغز** 🧩`,
                  ``,
                  `❌ **إجابة خاطئة! للأسف.**`,
                  `اللغز: **${riddleData.question}**`,
                  `الإجابة الصحيحة كانت: **${riddleData.options[riddleData.correctIndex]}**`,
                ].join("\n"),
              )
              .setTimestamp();

            await interaction.update({ embeds: [failEmbed], components: [endRow] });
          }
        });

        collector.on("end", async (collected, reason) => {
          if (reason === "time" && !gameEnded) {
            activeGames.delete(message.author.id);

            const timeoutRow = new ActionRowBuilder<any>();
            for (let i = 0; i < riddleData.options.length; i++) {
              const btn = new ButtonBuilder()
                .setCustomId(`riddle_end_${i}`)
                .setLabel(`${i + 1}. ${riddleData.options[i]}`)
                .setDisabled(true);

              if (i === riddleData.correctIndex) {
                btn.setStyle(ButtonStyle.Success);
              } else {
                btn.setStyle(ButtonStyle.Secondary);
              }
              timeoutRow.addComponents(btn);
            }

            const timeoutEmbed = new EmbedBuilder()
              .setColor(0xff0000)
              .setAuthor({
                name: message.author.username,
                iconURL: message.author.displayAvatarURL(),
              })
              .setDescription(
                [
                  `| **لغز** 🧩`,
                  ``,
                  `⏱️ **انتهى الوقت (30 ثانية) دون إجابة!**`,
                  `الإجابة الصحيحة كانت: **${riddleData.options[riddleData.correctIndex]}**`,
                ].join("\n"),
              )
              .setTimestamp();

            try {
              await responseMsg.edit({ embeds: [timeoutEmbed], components: [timeoutRow] });
            } catch (err) {
              console.error("Error sending riddle timeout msg:", err);
            }
          }
        });
      } catch (error) {
        console.error("Error in riddle command:", error);
        activeGames.delete(message.author.id);
        await responseMsg.edit({
          content: "❌ **حدث خطأ أثناء إعداد اللغز، يرجى المحاولة لاحقاً.**",
          embeds: [],
        });
      }

      return;
    }

    // Command: ايموجي
    if (content === "ايموجي") {
      if (
        activeGames.has(message.author.id) ||
        activeSessions.has(message.author.id)
      ) {
        await message.reply(
          "⚠️ **لديك عملية أو لعبة معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }

      if (!(await checkCooldown(message.author.id, "ايموجي", message))) return;

      activeGames.add(message.author.id);

      // List of emojis
      const emojiList = [
        "🏓",
        "🏀",
        "⚽",
        "🚗",
        "🍔",
        "🍕",
        "🧸",
        "🎮",
        "🐱",
        "🐶",
        "🦊",
        "🐸",
        "🍎",
        "🍌",
        "🍇",
      ];
      // Pick target emoji
      const targetEmoji =
        emojiList[Math.floor(Math.random() * emojiList.length)];

      // Pick 8 other unique emojis
      const otherEmojis: string[] = [];
      while (otherEmojis.length < 8) {
        const randomEmoji =
          emojiList[Math.floor(Math.random() * emojiList.length)];
        if (randomEmoji !== targetEmoji && !otherEmojis.includes(randomEmoji)) {
          otherEmojis.push(randomEmoji);
        }
      }

      // Merge and shuffle
      const gameEmojis = [targetEmoji, ...otherEmojis];
      for (let i = gameEmojis.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [gameEmojis[i], gameEmojis[j]] = [gameEmojis[j], gameEmojis[i]];
      }

      const targetIndex = gameEmojis.indexOf(targetEmoji);

      // 4th row for branding/logo button
      const bankEmoji =
        message.guild?.emojis.cache.find(
          (e) => e.name === "bank" || e.name === "fire_bank" || e.name === "c",
        ) || "🪙";
      const brandingRow = new ActionRowBuilder<any>().addComponents(
        new ButtonBuilder()
          .setCustomId("emoji_branding")
          .setEmoji(bankEmoji.toString())
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true),
      );

      // Create 3 rows of 3 buttons containing the real emojis, but disabled (memorization phase)
      const initialRows = [];
      for (let i = 0; i < 3; i++) {
        const row = new ActionRowBuilder<any>();
        for (let j = 0; j < 3; j++) {
          const idx = i * 3 + j;
          const btnEmoji = gameEmojis[idx];
          row.addComponents(
            new ButtonBuilder()
              .setCustomId(`emoji_initial_${idx}`)
              .setEmoji(btnEmoji)
              .setStyle(ButtonStyle.Secondary)
              .setDisabled(true),
          );
        }
        initialRows.push(row);
      }
      initialRows.push(brandingRow);

      const initialEmbed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `> **ايموجي**`,
            ``,
            `احفظ أماكن الإيموجي! سيتم إخفاء الأزرار وتحديد المطلوب بعد **5** ثوانٍ... ⏱️`,
          ].join("\n"),
        )
        .setTimestamp();

      const responseMsg = await message.reply({
        embeds: [initialEmbed],
        components: initialRows,
      });

      setTimeout(async () => {
        try {
          // Create 3 rows of 3 buttons with "?" (play phase)
          const playRows = [];
          for (let i = 0; i < 3; i++) {
            const row = new ActionRowBuilder<any>();
            for (let j = 0; j < 3; j++) {
              const idx = i * 3 + j;
              row.addComponents(
                new ButtonBuilder()
                  .setCustomId(`emoji_game_${idx}`)
                  .setLabel("?")
                  .setStyle(ButtonStyle.Secondary),
              );
            }
            playRows.push(row);
          }
          playRows.push(brandingRow);

          const playEmbed = new EmbedBuilder()
            .setColor(0x2b2d31)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `> **ايموجي**`,
                ``,
                `الأيموجي المطلوب : **${targetEmoji}**`,
                `لديك **00:10** للإختيار`,
              ].join("\n"),
            )
            .setTimestamp();

          await responseMsg.edit({
            embeds: [playEmbed],
            components: playRows,
          });

          const filter = (i: any) =>
            i.customId.startsWith("emoji_game_") && i.user.id === message.author.id;
          const collector = responseMsg.createMessageComponentCollector({
            filter,
            time: 10000,
          });

          let gameEnded = false;

          collector.on("collect", async (interaction) => {
            if (!interaction.isButton()) return;
            gameEnded = true;
            collector.stop("guessed");

            const clickedIdx = parseInt(
              interaction.customId.replace("emoji_game_", ""),
              10,
            );
            const profile = getUserProfile(message.author.id);
            activeGames.delete(message.author.id);

            const endRows = [];
            for (let i = 0; i < 3; i++) {
              const row = new ActionRowBuilder<any>();
              for (let j = 0; j < 3; j++) {
                const idx = i * 3 + j;
                const btnEmoji = gameEmojis[idx];
                const btn = new ButtonBuilder()
                  .setCustomId(`emoji_end_${idx}`)
                  .setEmoji(btnEmoji)
                  .setDisabled(true);

                if (idx === targetIndex) {
                  btn.setStyle(ButtonStyle.Success);
                } else if (idx === clickedIdx) {
                  btn.setStyle(ButtonStyle.Danger);
                } else {
                  btn.setStyle(ButtonStyle.Secondary);
                }
                row.addComponents(btn);
              }
              endRows.push(row);
            }
            endRows.push(brandingRow);

            if (clickedIdx === targetIndex) {
              const reward = 10000;
              profile.wallet += reward;

              const winEmbed = new EmbedBuilder()
                .setColor(0x00ff00)
                .setAuthor({
                  name: message.author.username,
                  iconURL: message.author.displayAvatarURL(),
                })
                .setDescription(
                  [
                    `| **ايموجي**`,
                    ``,
                    `🏆 **تهانينا! لقد نجحت في العثور على الأيموجي الصحيح ${targetEmoji}.**`,
                    `💰 **تم إضافة الجائزة:** \`10,000 $\` في محفظتك.`,
                    `👛 **رصيد محفظتك الجديد:** \`${profile.wallet.toLocaleString()} $\``,
                  ].join("\n"),
                )
                .setTimestamp();

              await interaction.update({
                embeds: [winEmbed],
                components: endRows,
              });
            } else {
              const failEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setAuthor({
                  name: message.author.username,
                  iconURL: message.author.displayAvatarURL(),
                })
                .setDescription(
                  [
                    `| **ايموجي**`,
                    ``,
                    `❌ **للأسف! لقد اخترت إيموجي خاطئ.**`,
                    `الأيموجي الصحيح كان: **${targetEmoji}**`,
                  ].join("\n"),
                )
                .setTimestamp();

              await interaction.update({
                embeds: [failEmbed],
                components: endRows,
              });
            }
          });

          collector.on("end", async (collected, reason) => {
            if (reason === "time" && !gameEnded) {
              activeGames.delete(message.author.id);

              const timeoutRows = [];
              for (let i = 0; i < 3; i++) {
                const row = new ActionRowBuilder<any>();
                for (let j = 0; j < 3; j++) {
                  const idx = i * 3 + j;
                  const btnEmoji = gameEmojis[idx];
                  const btn = new ButtonBuilder()
                    .setCustomId(`emoji_end_${idx}`)
                    .setEmoji(btnEmoji)
                    .setDisabled(true);

                  if (idx === targetIndex) {
                    btn.setStyle(ButtonStyle.Success);
                  } else {
                    btn.setStyle(ButtonStyle.Secondary);
                  }
                  row.addComponents(btn);
                }
                timeoutRows.push(row);
              }
              timeoutRows.push(brandingRow);

              const timeoutEmbed = new EmbedBuilder()
                .setColor(0xff0000)
                .setAuthor({
                  name: message.author.username,
                  iconURL: message.author.displayAvatarURL(),
                })
                .setDescription(
                  [
                    `| **ايموجي**`,
                    ``,
                    `⏱️ **انتهى الوقت (10 ثوانٍ) دون اختيار الأيموجي!**`,
                    `الأيموجي الصحيح كان: **${targetEmoji}**`,
                  ].join("\n"),
                )
                .setTimestamp();

              try {
                await responseMsg.edit({
                  embeds: [timeoutEmbed],
                  components: timeoutRows,
                });
              } catch (err) {
                console.error("Error updating emoji game on timeout:", err);
              }
            }
          });
        } catch (error) {
          console.error("Error in emoji game transition:", error);
          activeGames.delete(message.author.id);
        }
      }, 5000);

      return;
    }
    if (content === "ممتلكات") {
      if (!(await checkCooldown(message.author.id, "ممتلكات", message))) return;
      const profile = getUserProfile(message.author.id);
      const guildIconUrl = message.guild.iconURL({ size: 256 });
      let totalInventoryValue = 0;
      const itemsFields = [];
      for (const item of marketItems) {
        const qty = profile.inventory[item.id] || 0;
        if (qty > 0) {
          const itemValue = qty * item.currentPrice;
          totalInventoryValue += itemValue;
          itemsFields.push(
            `• ${item.emoji} **${item.name}**: \`${qty.toLocaleString("en-US")}\` حبة (بقيمة \`${itemValue.toLocaleString("en-US")} $\`)`,
          );
        }
      }
      const totalWealth = profile.wallet + profile.bank + totalInventoryValue;
      const embed = new EmbedBuilder()
        .setColor(2829617)
        .setTitle("📋 قائمة ممتلكاتك وأصولك المالية | Fire Bank")
        .setDescription(
          `مرحباً بك <@${message.author.id}>، إليك كشف حسابك المالي وممتلكاتك بالتفصيل:`,
        )
        .addFields(
          {
            name: "👛 الرصيد في المحفظة",
            value: `\`${profile.wallet.toLocaleString("en-US")} $\``,
            inline: true,
          },
          {
            name: "🏦 الرصيد في البنك",
            value: `\`${profile.bank.toLocaleString("en-US")} $\``,
            inline: true,
          },
          {
            name: "💰 إجمالي الثروة",
            value: `\`${totalWealth.toLocaleString("en-US")} $\``,
            inline: true,
          },
          {
            name: "📦 الممتلكات والسلع المخزنة",
            value:
              itemsFields.length > 0
                ? itemsFields.join("\n")
                : "لا تمتلك أي سلع في مخزونك حالياً.",
            inline: false,
          },
        )
        .setTimestamp();
      if (guildIconUrl) {
        embed.setThumbnail(guildIconUrl);
      }
      await message.reply({ embeds: [embed] });
      return;
    }
    if (content.startsWith("تداول")) {
      const match = content.match(/^تداول\s+(\d+)$/);
      if (!match) {
        if (content === "تداول") {
          const embed2 = new EmbedBuilder()
            .setColor(2829617)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **تداول**`,
                ``,
                `**طريقة الإستخدام :** \`تداول\` \`المبلغ\``,
              ].join("\n"),
            )
            .setTimestamp();
          await message.reply({ embeds: [embed2] });
        } else {
          await message.reply(
            "⚠️ **طريقة كتابة الأمر:** `تداول` `المبلغ`\n*(مثال: تداول 50000)*",
          );
        }
        return;
      }
      const amount = parseInt(match[1], 10);
      if (isNaN(amount) || amount <= 0) {
        await message.reply("❌ الرجاء إدخال مبلغ صحيح وأكبر من الصفر.");
        return;
      }
      if (amount < 5000) {
        await message.reply("❌ **لا يمكن تداول مبلغ أقل من 5,000 $!**");
        return;
      }
      const profile = getUserProfile(message.author.id);
      if (profile.wallet < amount) {
        await message.reply("❌ رصيدك في المحفظة غير كافٍ لإجراء هذه الصفقة.");
        return;
      }
      if (activeSessions.has(message.author.id)) {
        await message.reply(
          "⚠️ **لديك عملية معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }
      if (!(await checkCooldown(message.author.id, "تداول", message))) return;
      activeSessions.add(message.author.id);
      const embed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **تداول**`,
            ``,
            `المبلغ :`,
            `\`${amount.toLocaleString()}\``,
          ].join("\n"),
        )
        .setTimestamp();
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("trade_select_crypto")
        .setPlaceholder("اختر العملة")
        .addOptions([
          {
            label: "بتكوين (Bitcoin - BTC) 🪙",
            value: "btc",
            description: "العملة الرقمية الأكبر والأكثر ثباتاً",
          },
          {
            label: "إيثيريوم (Ethereum - ETH) 🔷",
            value: "eth",
            description: "منصة العقود الذكية الرائدة",
          },
          {
            label: "سولانا (Solana - SOL) 🪙",
            value: "sol",
            description: "الشبكة الفائقة السرعة ومنخفضة التكلفة",
          },
          {
            label: "دوج كوين (Dogecoin - DOGE) 🐕",
            value: "doge",
            description: "عملة الميمز الشهيرة ذات التقلبات العالية",
          },
        ]);
      const cancelBtn = new ButtonBuilder()
        .setCustomId("trade_cancel")
        .setLabel("إلغاء")
        .setStyle(ButtonStyle.Danger);
      const selectRow = new ActionRowBuilder<any>().addComponents(
        selectMenu,
      );
      const btnRow = new ActionRowBuilder<any>().addComponents(
        cancelBtn,
      );
      const responseMsg = await message.reply({
        embeds: [embed],
        components: [selectRow, btnRow],
      });
      const filter = (i: any) =>
        (i.customId === "trade_select_crypto" ||
          i.customId === "trade_cancel") &&
        i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        time: 60000,
      });
      collector.on("collect", async (interaction) => {
        if (interaction.customId === "trade_cancel") {
          collector.stop("cancelled");
          activeSessions.delete(message.author.id);
          const cancelEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription("❌ **تم إلغاء عملية التداول.**")
            .setTimestamp();
          await interaction.update({ embeds: [cancelEmbed], components: [] });
          return;
        }
        if (!interaction.isStringSelectMenu()) return;
        const selectedCrypto = interaction.values[0];
        const cryptoNames: Record<string, string> = {
          btc: "بتكوين (BTC)",
          eth: "إيثيريوم (ETH)",
          sol: "سولانا (SOL)",
          doge: "دوج كوين (DOGE)",
        };
        collector.stop("selected");
        activeSessions.delete(message.author.id);
        const isWin = Math.random() > 0.5;
        const resultEmbed = new EmbedBuilder().setTimestamp();
        profile.wallet -= amount;
        if (isWin) {
          const profitPercent = Math.floor(Math.random() * 101) + 20;
          const profit = Math.round(amount * (profitPercent / 100));
          const totalReturned = amount + profit;
          profile.wallet += totalReturned;
          resultEmbed
            .setColor(65280)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("🚀 صفقة تداول ناجحة!")
            .setDescription(
              [
                `لقد قمت بالتداول في عملة **${cryptoNames[selectedCrypto]}** بنجاح!`,
                `شهد السوق ارتفاعاً حاداً لأسعار العملات الرقمية.`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `• **مبلغ التداول:** \`${amount.toLocaleString("en-US")} $\``,
                `• **نسبة الصعود:** \`+${profitPercent}%\``,
                `• **الأرباح المحققة:** \`+${profit.toLocaleString("en-US")} $\``,
                `• **المبلغ الكلي المسترد:** \`${totalReturned.toLocaleString("en-US")} $\``,
                `👛 **رصيد محفظتك الحالي:** \`${profile.wallet.toLocaleString("en-US")} $\``,
              ].join("\n"),
            );
        } else {
          const lossPercent = Math.floor(Math.random() * 71) + 10;
          const loss = Math.round(amount * (lossPercent / 100));
          const totalReturned = amount - loss;
          profile.wallet += totalReturned;
          resultEmbed
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("📉 تراجع في صفقة التداول!")
            .setDescription(
              [
                `لقد قمت بالتداول في عملة **${cryptoNames[selectedCrypto]}**!`,
                `شهد السوق موجة هبوط مفاجئة أدت إلى خسارة جزء من قيمة التداول.`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `• **مبلغ التداول:** \`${amount.toLocaleString("en-US")} $\``,
                `• **نسبة الهبوط:** \`-${lossPercent}%\``,
                `• **الخسارة المترتبة:** \`-${loss.toLocaleString("en-US")} $\``,
                `• **المبلغ المتبقي المسترد:** \`${totalReturned.toLocaleString("en-US")} $\``,
                `👛 **رصيد محفظتك الحالي:** \`${profile.wallet.toLocaleString("en-US")} $\``,
              ].join("\n"),
            );
        }
        await interaction.update({ embeds: [resultEmbed], components: [] });
      });
      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          activeSessions.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("❌ انتهى وقت الجلسة")
            .setDescription(
              "انتهت الـ 60 ثانية دون اختيار أي عملة تداول. تم إلغاء الصفقة.",
            )
            .setTimestamp();
          await responseMsg.edit({ embeds: [timeoutEmbed], components: [] });
        }
      });
      return;
    }
    if (content.startsWith("استثمار")) {
      const match = content.match(/^استثمار\s+(\d+)$/);
      if (!match) {
        if (content === "استثمار") {
          const embed2 = new EmbedBuilder()
            .setColor(2829617)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription(
              [
                `| **استثمار**`,
                ``,
                `**طريقة الإستخدام :** \`استثمار\` \`المبلغ\``,
              ].join("\n"),
            )
            .setTimestamp();
          await message.reply({ embeds: [embed2] });
        } else {
          await message.reply(
            "⚠️ **طريقة كتابة الأمر:** `استثمار` `المبلغ`\n*(مثال: استثمار 100000)*",
          );
        }
        return;
      }
      const amount = parseInt(match[1], 10);
      if (isNaN(amount) || amount <= 0) {
        await message.reply("❌ الرجاء إدخال مبلغ صحيح وأكبر من الصفر.");
        return;
      }
      if (amount < 5000) {
        await message.reply("❌ **لا يمكن استثمار مبلغ أقل من 5,000 $!**");
        return;
      }
      const profile = getUserProfile(message.author.id);
      if (profile.wallet < amount) {
        await message.reply(
          "❌ رصيدك في المحفظة غير كافٍ لإجراء هذا الاستثمار.",
        );
        return;
      }
      if (activeSessions.has(message.author.id)) {
        await message.reply(
          "⚠️ **لديك عملية معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.",
        );
        return;
      }
      if (!(await checkCooldown(message.author.id, "استثمار", message))) return;
      activeSessions.add(message.author.id);
      const embed = new EmbedBuilder()
        .setColor(2829617)
        .setAuthor({
          name: message.author.username,
          iconURL: message.author.displayAvatarURL(),
        })
        .setDescription(
          [
            `| **استثمار**`,
            ``,
            `المبلغ :`,
            `\`${amount.toLocaleString()}\``,
          ].join("\n"),
        )
        .setTimestamp();
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId("invest_select_company")
        .setPlaceholder("اختر الشركة")
        .addOptions([
          {
            label: "جوجل (Google) 🌐",
            value: "google",
            description: "عملاق التكنولوجيا والذكاء الاصطناعي العالمي",
          },
          {
            label: "مايكروسوفت (Microsoft) 💻",
            value: "microsoft",
            description: "رائدة البرمجيات والخدمات السحابية",
          },
          {
            label: "أبل (Apple) 🍏",
            value: "apple",
            description: "الشركة الرائدة في مجال الأجهزة الذكية",
          },
          {
            label: "تيسلا (Tesla) 🚗",
            value: "tesla",
            description: "الشركة الأبرز في صناعة السيارات الكهربائية والطاقة",
          },
          {
            label: "أمازون (Amazon) 🛍️",
            value: "amazon",
            description: "رائد التجارة الإلكترونية والخدمات التقنية",
          },
        ]);
      const cancelBtn = new ButtonBuilder()
        .setCustomId("invest_cancel")
        .setLabel("إلغاء")
        .setStyle(ButtonStyle.Danger);
      const selectRow = new ActionRowBuilder<any>().addComponents(
        selectMenu,
      );
      const btnRow = new ActionRowBuilder<any>().addComponents(
        cancelBtn,
      );
      const responseMsg = await message.reply({
        embeds: [embed],
        components: [selectRow, btnRow],
      });
      const filter = (i: any) =>
        (i.customId === "invest_select_company" ||
          i.customId === "invest_cancel") &&
        i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        time: 60000,
      });
      collector.on("collect", async (interaction) => {
        if (interaction.customId === "invest_cancel") {
          collector.stop("cancelled");
          activeSessions.delete(message.author.id);
          const cancelEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setDescription("❌ **تم إلغاء عملية الاستثمار.**")
            .setTimestamp();
          await interaction.update({ embeds: [cancelEmbed], components: [] });
          return;
        }
        if (!interaction.isStringSelectMenu()) return;
        const selectedCompany = interaction.values[0];
        const companyNames: Record<string, string> = {
          google: "جوجل (Google)",
          microsoft: "مايكروسوفت (Microsoft)",
          apple: "أبل (Apple)",
          tesla: "تيسلا (Tesla)",
          amazon: "أمازون (Amazon)",
        };
        collector.stop("selected");
        activeSessions.delete(message.author.id);
        const isWin = Math.random() < 0.7;
        const resultEmbed = new EmbedBuilder().setTimestamp();
        profile.wallet -= amount;
        if (isWin) {
          const profitPercent = Math.floor(Math.random() * 41) + 10;
          const profit = Math.round(amount * (profitPercent / 100));
          const totalReturned = amount + profit;
          profile.wallet += totalReturned;
          resultEmbed
            .setColor(65280)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("📈 استثمار ناجح وأرباح محققة!")
            .setDescription(
              [
                `لقد قمت بالاستثمار في شركة **${companyNames[selectedCompany]}** بنجاح!`,
                `حققت الشركة نتائج مالية استثنائية هذا الربع مما رفع قيمة أسهمها.`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `• **المبلغ المستثمر:** \`${amount.toLocaleString("en-US")} $\``,
                `• **نسبة الصعود:** \`+${profitPercent}%\``,
                `• **الأرباح المحققة:** \`+${profit.toLocaleString("en-US")} $\``,
                `• **المبلغ الكلي المسترد:** \`${totalReturned.toLocaleString("en-US")} $\``,
                `👛 **رصيد محفظتك الحالي:** \`${profile.wallet.toLocaleString("en-US")} $\``,
              ].join("\n"),
            );
        } else {
          const lossPercent = Math.floor(Math.random() * 26) + 5;
          const loss = Math.round(amount * (lossPercent / 100));
          const totalReturned = amount - loss;
          profile.wallet += totalReturned;
          resultEmbed
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("📉 تراجع في قيمة الاستثمار!")
            .setDescription(
              [
                `لقد قمت بالاستثمار في شركة **${companyNames[selectedCompany]}**!`,
                `تأثرت أسهم الشركة مؤقتاً بتقلبات السوق العالمي والاقتصاد.`,
                `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
                `• **المبلغ المستثمر:** \`${amount.toLocaleString("en-US")} $\``,
                `• **نسبة الهبوط:** \`-${lossPercent}%\``,
                `• **الخسارة المترتبة:** \`-${loss.toLocaleString("en-US")} $\``,
                `• **المبلغ المتبقي المسترد:** \`${totalReturned.toLocaleString("en-US")} $\``,
                `👛 **رصيد محفظتك الحالي:** \`${profile.wallet.toLocaleString("en-US")} $\``,
              ].join("\n"),
            );
        }
        await interaction.update({ embeds: [resultEmbed], components: [] });
      });
      collector.on("end", async (collected, reason) => {
        if (reason === "time") {
          activeSessions.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(16711680)
            .setAuthor({
              name: message.author.username,
              iconURL: message.author.displayAvatarURL(),
            })
            .setTitle("❌ انتهى وقت الجلسة")
            .setDescription(
              "انتهت الـ 60 ثانية دون اختيار أي شركة للاستثمار. تم إلغاء العملية.",
            )
            .setTimestamp();
          await responseMsg.edit({ embeds: [timeoutEmbed], components: [] });
        }
      });
      return;
    }
    if (content.startsWith("تصفير")) {
      const isConfigOwner =
        message.author.id === message.guild.ownerId ||
        message.member?.permissions.has("Administrator");
      if (!isConfigOwner) {
        await message.reply("❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**");
        return;
      }
      const match = content.match(/^تصفير\s+(<@!?\d+>)$/);
      if (match) {
        const targetId = match[1].replace(/[<@!>]/g, "");
        userProfiles.delete(targetId);
        await message.reply(
          `✅ **تم تصفير رصيد وممتلكات العضو <@${targetId}> بنجاح!**`,
        );
      } else if (content === "تصفير") {
        userProfiles.clear();
        await message.reply(
          "✅ **تم تصفير جميع أرصدة وممتلكات الحسابات في البوت بنجاح!**",
        );
      } else {
        await message.reply(
          "⚠️ **طريقة كتابة الأمر:**\n• لتصفير الكل: `تصفير`\n• لتصفير عضو محدد: `تصفير @العضو`",
        );
      }
      return;
    }
    if (
      content.startsWith("/abb-channel") ||
      content.startsWith("abb-channel")
    ) {
      const isConfigOwner =
        message.author.id === message.guild.ownerId ||
        message.member?.permissions.has("Administrator");
      if (!isConfigOwner) {
        await message.reply("❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**");
        return;
      }
      const channelMentions = message.mentions.channels;
      if (channelMentions.size === 0) {
        await message.reply(
          "⚠️ **طريقة كتابة الأمر:**\n• `/abb-channel #روم1 #روم2 #روم3` (تحديد حتى 3 رومات)",
        );
        return;
      }
      if (channelMentions.size > 3) {
        await message.reply(
          "❌ **خطأ:** لا يمكن تفعيل البوت في أكثر من 3 رومات!",
        );
        return;
      }
      const tempChannels = Array.from(channelMentions.keys());
      allowedChannels = tempChannels;
      saveAllowedChannels(allowedChannels);
      const channelListString = allowedChannels
        .map((id) => `<#${id}>`)
        .join(" ، ");
      await message.reply(`✅ **تم تفعيل البوت بنجاح في الغرف المحددة:**
• ${channelListString}
*(لن يستجيب البوت لأي أمر خارج هذه الغرف)*`);
      return;
    }
    if (isRoomConfigMention) {
      const isConfigOwner =
        message.author.id === message.guild.ownerId ||
        message.member?.permissions.has("Administrator");
      if (!isConfigOwner) {
        await message.reply("❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**");
        return;
      }
      const botMentionRegex = new RegExp(
        `^<@!?${client.user?.id}>\\s+room\\s+<#(\\d+)>`,
        "i",
      );
      const mentionMatch = content.match(botMentionRegex);
      if (!mentionMatch) {
        await message.reply(
          "⚠️ **طريقة كتابة الأمر:**\n• `@البوت room #الروم`",
        );
        return;
      }
      const targetChannelId = mentionMatch[1];
      allowedChannels = [targetChannelId];
      saveAllowedChannels(allowedChannels);
      await message.reply(`تم تفعيل البوت في <#${targetChannelId}>`);
      return;
    }
    if (isArabicRoomMention) {
      const isConfigOwner =
        message.author.id === message.guild?.ownerId ||
        message.member?.permissions.has("Administrator");
      if (!isConfigOwner) {
        await message.reply("❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**");
        return;
      }
      let cleanContent = content;
      if (cleanContent.startsWith(botMentionPrefix)) {
        cleanContent = cleanContent.slice(botMentionPrefix.length).trim();
      } else if (cleanContent.startsWith(botMentionPrefixNick)) {
        cleanContent = cleanContent.slice(botMentionPrefixNick.length).trim();
      }
      if (cleanContent.startsWith("روم")) {
        const roomArg = cleanContent.slice(3).trim();
        if (!roomArg) {
          await message.reply(
            "⚠️ **طريقة كتابة الأمر:**\n• `@البوت روم #الروم` أو `@البوت روم اسم_الروم`",
          );
          return;
        }
        let targetChannelId = null;
        const mentionMatch =
          roomArg.match(/^&?lt;#(\d+)&?gt;/i) || roomArg.match(/^<#(\d+)>/);
        const rawMentionMatch = roomArg.match(/^<#(\d+)>$/);
        if (rawMentionMatch) {
          targetChannelId = rawMentionMatch[1];
        } else {
          if (message.guild) {
            const channels = message.guild.channels.cache;
            let searchName = roomArg;
            if (searchName.startsWith("#")) {
              searchName = searchName.slice(1);
            }
            let foundChannel = channels.find(
              (c) =>
                c.name.toLowerCase() === searchName.toLowerCase() &&
                c.isTextBased(),
            );
            if (!foundChannel && /^\d+$/.test(roomArg)) {
              foundChannel = channels.get(roomArg);
            }
            if (foundChannel) {
              targetChannelId = foundChannel.id;
            }
          }
        }
        if (!targetChannelId) {
          await message.reply(
            "❌ **لم يتم العثور على القناة المحددة.** يرجى التأكد من اسم القناة أو عمل منشن لها.",
          );
          return;
        }
        if (allowedChannels.includes(targetChannelId)) {
          allowedChannels = allowedChannels.filter(
            (id) => id !== targetChannelId,
          );
          saveAllowedChannels(allowedChannels);
          await message.reply(
            `✅ تم إلغاء ارتباط البوت بنجاح عن الروم: <#${targetChannelId}>`,
          );
        } else {
          await message.reply("❌ **هذه القناة غير مرتبطة بالبوت حالياً.**");
        }
      }
      return;
    }
    const wordCount = content.split(/\s+/).filter((w) => w.length > 0).length;
    const isShortCommandAttempt = wordCount > 0 && wordCount <= 3;
    if (isMentioned || isShortCommandAttempt) {
      if (openRouterService.hasValidKey()) {
        const botMention = `<@${client.user?.id}>`;
        const botMentionNick = `<@!${client.user?.id}>`;
        const prompt = content
          .replace(botMention, "")
          .replace(botMentionNick, "")
          .trim();
        try {
          if (prompt.length > 0) {
            await message.channel.sendTyping();
            const liveContext = getAiContextString(message.author.id);
            const aiResponse = await openRouterService.generateResponse(
              message.author.id,
              prompt,
              liveContext,
            );
            if (aiResponse.startsWith("❌") || aiResponse.startsWith("⚠️")) {
              if (isMentioned) {
                await message.reply(aiResponse);
              }
            } else {
              await message.reply(aiResponse);
            }
          } else if (isMentioned) {
            await message.reply("أهلاً! كيف يمكنني مساعدتك اليوم؟ 🪙");
          }
        } catch (error) {
          console.error("Error handling AI fallback response:", error);
          if (isMentioned) {
            await message.reply("❌ حدث خطأ أثناء معالجة طلبك.");
          }
        }
      } else {
        if (isMentioned) {
          await message.reply(
            "أهلاً! أنا بوت **Fire Bank** 🪙. لتفعيل المساعد الذكي بالذكاء الاصطناعي، يرجى إعداد مفتاح OpenRouter API في ملف الإعدادات `.env` الخاص بالبوت. يمكنك استخدام الأوامر المتاحة مثل `اسعار` أو `شراء` أو `لعبة`.",
          );
        }
      }
      return;
    }
  } catch (error) {
    console.error("Error:", error);
  }
});
const port = process.env.PORT || 3e3;
const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain; charset=utf-8" });
  res.end("Fire Bank Bot is online!");
});
server.on("error", (err: any) => {
  if (err.code === "EADDRINUSE") {
    console.log(`⚠️ Port ${port} is already in use, continuing bot execution...`);
  } else {
    console.error("HTTP server error:", err);
  }
});
server.listen(port, () => {
  console.log(`🌍 HTTP server is listening on port ${port}`);
});
client.login(token);
