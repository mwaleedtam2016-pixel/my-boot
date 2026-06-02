import 'dotenv/config';
import fs from 'fs';
import path from 'path';
import http from 'http';
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
  Partials
} from 'discord.js';

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  throw new Error('DISCORD_BOT_TOKEN is missing in .env');
}

// User profile interface for balance and inventory management
interface UserProfile {
  wallet: number;
  bank: number;
  inventory: {
    land: number;
    stock: number;
    car: number;
    plane: number;
    phone: number;
    train: number;
    stadium: number;
  };
}

// Persistence for allowed channels
const CONFIG_FILE = path.join(__dirname, '../allowed_channels.json');

function loadAllowedChannels(): string[] {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return JSON.parse(data);
    }
  } catch (err) {
    console.error('Failed to load allowed channels:', err);
  }
  return [];
}

function saveAllowedChannels(channels: string[]) {
  try {
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(channels, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed to save allowed channels:', err);
  }
}

// In-memory list of allowed channel IDs
let allowedChannels: string[] = loadAllowedChannels();

// In-memory database of user profiles
const userProfiles = new Map<string, UserProfile>();

function getUserProfile(userId: string): UserProfile {
  if (!userProfiles.has(userId)) {
    userProfiles.set(userId, {
      wallet: 0, // Starts at 0 $
      bank: 0,
      inventory: {
        land: 0,
        stock: 0,
        car: 0,
        plane: 0,
        phone: 0,
        train: 0,
        stadium: 0,
      }
    });
  }
  return userProfiles.get(userId)!;
}

// Global set to keep track of active purchase/sell sessions per user
const activeSessions = new Set<string>();

// Global set to keep track of active game sessions per user
const activeGames = new Set<string>();

// Cooldowns database for countdown command
const cooldowns = new Map<string, number>();

// Global command cooldowns map: key is "userId_commandName", value is expiration timestamp
const commandCooldowns = new Map<string, number>();

// Cooldown durations in milliseconds (10 minutes for games/rob/invest/trade, 5 seconds for buying/selling)
const COOLDOWN_DURATIONS: { [key: string]: number } = {
  'لعبة': 600000,       // 10 minutes
  'نهب': 600000,       // 10 minutes
  'تداول': 600000,     // 10 minutes
  'استثمار': 600000,   // 10 minutes
  'شراء': 5000,        // 5 seconds
  'بيع': 5000          // 5 seconds
};

async function checkCooldown(userId: string, commandName: string, message: Message): Promise<boolean> {
  const cooldownKey = `${userId}_${commandName}`;
  const now = Date.now();
  const duration = COOLDOWN_DURATIONS[commandName] || 0;

  if (duration === 0) return true;

  if (commandCooldowns.has(cooldownKey)) {
    const expirationTime = commandCooldowns.get(cooldownKey)!;
    if (now < expirationTime) {
      const targetTimestamp = Math.floor(expirationTime / 1000);
      await message.reply(`❌ **عذراً، هذا الأمر في فترة التبريد!**\nيرجى الانتظار، يمكنك استخدامه مجدداً بعد: <t:${targetTimestamp}:R>`);
      return false;
    }
  }

  // Set cooldown
  commandCooldowns.set(cooldownKey, now + duration);
  return true;
}

interface MarketItem {
  id: string;
  name: string;
  emoji: string;
  basePrice: number;
  minPrice: number;
  maxPrice: number;
  currentPrice: number;
  lastPrice: number;
}

// Market items configured exactly as shown in the user's screenshot
const marketItems: MarketItem[] = [
  { id: 'land', name: 'أراضي', emoji: '🏙️', basePrice: 275000, minPrice: 200000, maxPrice: 350000, currentPrice: 275000, lastPrice: 275000 },
  { id: 'stock', name: 'أسهم', emoji: '📊', basePrice: 44000, minPrice: 30000, maxPrice: 60000, currentPrice: 44000, lastPrice: 44000 },
  { id: 'car', name: 'سيارات', emoji: '🚗', basePrice: 53000, minPrice: 40000, maxPrice: 70000, currentPrice: 53000, lastPrice: 53000 },
  { id: 'plane', name: 'طائرات', emoji: '✈️', basePrice: 200000, minPrice: 150000, maxPrice: 280000, currentPrice: 200000, lastPrice: 200000 },
  { id: 'phone', name: 'هواتف', emoji: '📱', basePrice: 9600, minPrice: 7000, maxPrice: 13000, currentPrice: 9600, lastPrice: 9600 },
  { id: 'train', name: 'قطارات', emoji: '🚄', basePrice: 596000, minPrice: 450000, maxPrice: 750000, currentPrice: 596000, lastPrice: 596000 },
  { id: 'stadium', name: 'ملاعب', emoji: '🏟️', basePrice: 5330000, minPrice: 4000000, maxPrice: 7000000, currentPrice: 5330000, lastPrice: 5330000 },
];

let lastUpdateTimestamp = Date.now();
const UPDATE_INTERVAL = 300000; // 5 minutes in milliseconds

function updateMarketPrices() {
  for (const item of marketItems) {
    item.lastPrice = item.currentPrice;
    // Fluctuate by a random percentage between -10% and +10% (reasonable fluctuation)
    const changePercent = (Math.random() * 20 - 10) / 100;
    let newPrice = Math.round(item.currentPrice * (1 + changePercent));
    
    // Clamp between min and max price
    if (newPrice < item.minPrice) newPrice = item.minPrice;
    if (newPrice > item.maxPrice) newPrice = item.maxPrice;
    
    item.currentPrice = newPrice;
  }
  lastUpdateTimestamp = Date.now();
  console.log('🔄 Market prices updated!');
}

// Update prices every 5 minutes
setInterval(updateMarketPrices, UPDATE_INTERVAL);

function getTrendEmoji(item: MarketItem): string {
  const diff = item.currentPrice - item.lastPrice;
  if (diff > 0) return '🔺';
  if (diff < 0) return '🔻';
  return '▶️';
}

function getMarketEmbed(guildIconUrl: string | null): EmbedBuilder {
  const nextUpdate = lastUpdateTimestamp + UPDATE_INTERVAL;
  const embed = new EmbedBuilder()
    .setColor(0x2b2d31) // Dark theme color matching modern Discord embeds
    .setDescription([
      `| **الاسعار**`,
      ``,
      `| **سيتم تحديث الاسعار بعد :** <t:${Math.floor(nextUpdate / 1000)}:R>`,
      `━━━━━━━━━━━━━━━━━━━━━━━━━━`
    ].join('\n'))
    .setTimestamp();

  if (guildIconUrl) {
    embed.setThumbnail(guildIconUrl);
  }

  for (const item of marketItems) {
    const trend = getTrendEmoji(item);
    embed.addFields({
      name: `${item.emoji} **${item.name}** :`,
      value: `${trend} \`${item.currentPrice.toLocaleString()} $\``,
      inline: true
    });
  }

  return embed;
}

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

// Game reward calculator: yields more for beginners/low-balance, less for rich users
function calculateGameReward(walletBalance: number): number {
  const lowLimit = 50000;
  const highLimit = 5000000;
  let t = (walletBalance - lowLimit) / (highLimit - lowLimit);
  t = Math.max(0, Math.min(1, t)); // clamp between 0 and 1
  
  // Interpolate min and max reward based on wealth/wallet
  const minReward = Math.round(4000 - t * 3000); // 4000 when low, 1000 when high
  const maxReward = Math.round(5000 - t * 3500); // 5000 when low, 1500 when high
  
  const reward = Math.floor(Math.random() * (maxReward - minReward + 1)) + minReward;
  return Math.max(1000, Math.min(5000, reward));
}

// All other game functions have been removed, leaving only the Rock Paper Scissors game implementation in 'لعبة' command

client.once('ready', async () => {
  console.log(`✅ Fire Bank is online as ${client.user?.tag}`);

  // Register Slash Command /abb-channel
  try {
    console.log('Registering slash commands...');
    await client.application?.commands.set([
      {
        name: 'abb-channel',
        description: 'تحديد الغرف التي يمكن للبوت العمل فيها (بحد أقصى 3 غرف)',
        options: [
          {
            name: 'channel1',
            description: 'الروم الأول المسموح به للعمليات البنكية',
            type: 7, // ApplicationCommandOptionType.Channel
            channel_types: [0], // ChannelType.GuildText (TextChannel)
            required: true,
          },
          {
            name: 'channel2',
            description: 'الروم الثاني المسموح به للعمليات البنكية (اختياري)',
            type: 7,
            channel_types: [0],
            required: false,
          },
          {
            name: 'channel3',
            description: 'الروم الثالث المسموح به للعمليات البنكية (اختياري)',
            type: 7,
            channel_types: [0],
            required: false,
          }
        ]
      }
    ]);
    console.log('Slash commands registered successfully!');
  } catch (err) {
    console.error('Error registering slash commands:', err);
  }
});

client.on('interactionCreate', async (interaction) => {
  try {
    if (!interaction.isChatInputCommand()) return;

    if (interaction.commandName === 'abb-channel') {
      const isConfigOwner = interaction.user.id === interaction.guild?.ownerId || 
                            (interaction.memberPermissions && interaction.memberPermissions.has('Administrator'));
      
      if (!isConfigOwner) {
        await interaction.reply({ content: '❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**', ephemeral: true });
        return;
      }

      const ch1 = interaction.options.getChannel('channel1');
      const ch2 = interaction.options.getChannel('channel2');
      const ch3 = interaction.options.getChannel('channel3');

      const tempChannels: string[] = [];
      if (ch1) tempChannels.push(ch1.id);
      if (ch2) tempChannels.push(ch2.id);
      if (ch3) tempChannels.push(ch3.id);

      allowedChannels = tempChannels;
      saveAllowedChannels(allowedChannels);

      const channelListString = allowedChannels.map(id => `<#${id}>`).join(' ، ');
      await interaction.reply({
        content: `✅ **تم تفعيل البوت بنجاح في الغرف المحددة:**\n• ${channelListString}\n*(لن يستجيب البوت لأي أمر خارج هذه الغرف)*`
      });
    }
  } catch (err) {
    console.error('Error in interactionCreate:', err);
  }
});

client.on('messageCreate', async (message) => {
  try {
    if (message.author.bot) return;

    // Handle Direct Messages (الخاص)
    if (!message.guild) {
      const dmContent = message.content.trim().toLowerCase();

      // Greetings check
      const greetings = ['أهلاً', 'اهلاً', 'أهلا', 'اهلا', 'هلا', 'مرحبا', 'مرحباً', 'سلام', 'السلام عليكم', 'hi', 'hello', 'hey'];
      const isGreeting = greetings.some(g => dmContent.includes(g.toLowerCase()));

      if (isGreeting) {
        await message.reply('أهلاً، كيف يمكنني مساعدتك؟ هل لديك استفسار بخصوص البوت؟');
        return;
      }

      // Check for keywords about games/commands
      if (
        dmContent.includes('ألعاب') || dmContent.includes('العاب') || 
        dmContent.includes('لعبة') || dmContent.includes('لعبه') || 
        dmContent.includes('لعب') || dmContent.includes('حجرة') || 
        dmContent.includes('ورقة') || dmContent.includes('مقص')
      ) {
        await message.reply([
          `🎮 **قسم الألعاب والترفيه في البوت:**`,
          `• يمكنك لعب **حجرة ورقة مقص** ضد البوت عبر كتابة \`لعبة\` أو \`لعبه\` في الروم المخصص.`,
          `• تُمنح جوائز مالية عند الفوز تعتمد على رصيد محفظتك الحالي (المبتدئون يحصلون على مكافآت أكبر!).`,
          `• لا يمكنك تشغيل أكثر من لعبة في نفس الوقت.`,
          ``,
          `يرجى التوجه لقناة البنك المحددة في سيرفرك للبدء باللعب!`
        ].join('\n'));
        return;
      }

      // Check for keywords about trading / investment
      if (
        dmContent.includes('تداول') || dmContent.includes('استثمار') || 
        dmContent.includes('أسهم') || dmContent.includes('اسهم') || 
        dmContent.includes('عملات') || dmContent.includes('بتكوين') || 
        dmContent.includes('سهم') || dmContent.includes('شركة')
      ) {
        await message.reply([
          `📈 **قسم الاستثمار والتداول في البوت:**`,
          `• **التداول الرقمي:** اكتب \`تداول [المبلغ]\` للتداول بالعملات المشفرة (BTC, ETH, SOL, DOGE) مع فرصة ربح أو خسارة 50%.`,
          `• **الاستثمار:** اكتب \`استثمار [المبلغ]\` للاستثمار في الشركات الكبرى (Google, Microsoft, Apple...) بنسبة نجاح 70%.`,
          `• **الحد الأدنى:** يُمنع تداول أو استثمار أي مبلغ يقل عن \`5,000 $\`.`,
          ``,
          `يرجى الذهاب للروم المخصص في سيرفرك لتجربة العمليات المالية!`
        ].join('\n'));
        return;
      }

      // Check for keywords about market / buy / sell
      if (
        dmContent.includes('سوق') || dmContent.includes('متجر') || 
        dmContent.includes('أسعار') || dmContent.includes('اسعار') || 
        dmContent.includes('شراء') || dmContent.includes('بيع') || 
        dmContent.includes('ممتلكات')
      ) {
        await message.reply([
          `🛍️ **سوق السلع والممتلكات:**`,
          `• **الأسعار:** اكتب \`اسعار\` لعرض سوق السلع (أراضي، سيارات، أسهم...) ومؤشرات الصعود والهبوط اليومية.`,
          `• **الشراء والبيع:** استخدم الأوامر \`شراء [الكمية]\` أو \`بيع [الكمية]\` للتجارة بالسلع المتاحة.`,
          `• **كشف الحساب:** اكتب \`ممتلكات\` لمعرفة رصيدك المالي في المحفظة والبنك وقائمة سلعك.`,
          `• **السعة القصوى:** الحد الأقصى للمخزون هو 100 حبة لكل سلعة.`
        ].join('\n'));
        return;
      }

      // Check for keywords about setup / room
      if (
        dmContent.includes('تفعيل') || dmContent.includes('تشغيل') || 
        dmContent.includes('روم') || dmContent.includes('قناة') || 
        dmContent.includes('غرفة') || dmContent.includes('setup') || 
        dmContent.includes('abb-channel')
      ) {
        await message.reply([
          `🛠️ **تفعيل البوت وتعيين الرومات:**`,
          `• يمكن لمدير السيرفر تعيين القنوات المسموحة لعمل البوت (بحد أقصى 3 رومات).`,
          `• **الأوامر المتاحة:**`,
          `  1. الأمر التفاعلي: \`/abb-channel\` (Slash Command)`,
          `  2. الأمر النصي: \`/abb-channel #قناة1 #قناة2\``,
          `  3. منشن التفعيل: \`@Fire Bank room #قناة\``,
          `• **تنبيه:** إذا لم يتم تحديد قنوات بعد، سيعمل البوت فقط في قناة باسم **"البنك"**.`
        ].join('\n'));
        return;
      }

      // General fallback (Server-specialized AI assistant response)
      await message.reply([
        `أنا المساعد الذكي الخاص بـ **Fire Bank** 🪙.`,
        `أنا مخصص ومبرمج للتعريف بالبوت ومهامه فقط.`,
        ``,
        `يمكنك الاستفسار عن أحد المواضيع التالية وكتابة كلماتها المفتاحية:`,
        `• 🎮 **الألعاب** (اكتب: ألعاب أو لعبة)`,
        `• 📈 **التداول والاستثمار** (اكتب: تداول أو استثمار)`,
        `• 🛍️ **السوق المالي** (اكتب: اسعار أو شراء أو بيع)`,
        `• 🛠️ **إعداد السيرفر** (اكتب: تفعيل أو روم)`
      ].join('\n'));
      return;
    }

    if (!message.guild) return;

    const content = message.content.trim();

    // Check channel restrictions (bypass for setup commands)
    const botMentionPrefix = `<@${client.user?.id}>`;
    const botMentionPrefixNick = `<@!${client.user?.id}>`;
    const isRoomConfigMention = (content.startsWith(botMentionPrefix) || content.startsWith(botMentionPrefixNick)) && 
                                 content.toLowerCase().includes('room');
    const isArabicRoomMention = (content.startsWith(botMentionPrefix) || content.startsWith(botMentionPrefixNick)) && 
                                 content.includes('روم');

    const isSetupCmd = content.startsWith('/abb-channel') || content.startsWith('abb-channel') || isRoomConfigMention || isArabicRoomMention;
    if (!isSetupCmd) {
      if (allowedChannels.length > 0) {
        if (!allowedChannels.includes(message.channel.id)) return;
      } else {
        if ('name' in message.channel && message.channel.name !== 'البنك') return;
      }
    }
    console.log(`Received: "${content}"`);

    // 0. Command: وقت
    if (content === 'وقت' || content === 'وثت') {
      const guildIconUrl = message.guild.iconURL({ size: 256 }) || client.user?.displayAvatarURL({ size: 256 });
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setDescription([
          `\u200f🟢 اسعار`,
          `\u200f🟢 شراء`,
          `\u200f🟢 بيع`,
          `\u200f🟢 نهب`,
          `\u200f🟢 ممتلكات`,
          `\u200f🟢 لعبة`,
          `\u200f🟢 تداول`,
          `\u200f🟢 استثمار`,
          `\u200f🟢 مؤقت`,
          `\u200f🟢 وقت`
        ].join('\n'))
        .setTimestamp();

      if (guildIconUrl) {
        embed.setThumbnail(guildIconUrl);
      }

      await message.reply({ embeds: [embed] });
      return;
    }

    // 1. Command: اسعار / أسعار / متجر / سوق
    if (content === 'اسعار' || content === 'أسعار' || content === 'سوق' || content === 'متجر') {
      const guildIconUrl = message.guild.iconURL({ size: 256 });
      const embed = getMarketEmbed(guildIconUrl);
      await message.reply({ embeds: [embed] });
      return;
    }

    // 2. Command: شراء [الكمية]
    if (content.startsWith('شراء')) {
      const buyMatch = content.match(/^شراء\s+(\d+)$/);
      if (!buyMatch) {
        await message.reply('⚠️ **طريقة كتابة الأمر:** شراء [الكمية]\n*(مثال: شراء 5)*');
        return;
      }

      const qty = parseInt(buyMatch[1], 10);
      if (isNaN(qty) || qty <= 0) {
        await message.reply('❌ الرجاء كتابة كمية صحيحة وأكبر من الصفر.');
        return;
      }

      if (activeSessions.has(message.author.id)) {
        await message.reply('⚠️ **لديك عملية شراء أو بيع معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.');
        return;
      }

      if (!await checkCooldown(message.author.id, 'شراء', message)) return;

      activeSessions.add(message.author.id);

      const guildIconUrl = message.guild.iconURL({ size: 256 });
      const embed = getMarketEmbed(guildIconUrl);
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('buy_select_item')
        .setPlaceholder('اختر السلعة التي ترغب بشرائها من هنا...')
        .addOptions(
          marketItems.map(item => ({
            label: item.name,
            value: item.id,
            emoji: item.emoji,
            description: `السعر الحالي: ${item.currentPrice.toLocaleString()} $`
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      
      const responseMsg = await message.reply({
        embeds: [embed],
        components: [row]
      });

      const filter = (i: any) => i.customId === 'buy_select_item' && i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        componentType: ComponentType.StringSelect,
        time: 60000
      });

      collector.on('collect', async (interaction) => {
        const selectedId = interaction.values[0];
        const selectedItem = marketItems.find(item => item.id === selectedId);

        if (!selectedItem) {
          activeSessions.delete(message.author.id);
          collector.stop();
          await interaction.reply({ content: '❌ حدث خطأ، لم يتم العثور على العنصر.', ephemeral: true });
          return;
        }

        collector.stop();

        const profile = getUserProfile(message.author.id);
        const totalCost = selectedItem.currentPrice * qty;
        const currentQty = profile.inventory[selectedItem.id as keyof typeof profile.inventory] || 0;

        // Check wallet balance
        if (profile.wallet < totalCost) {
          activeSessions.delete(message.author.id);
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000) // Red bar indicating failure
            .setTitle('❌ فشلت عملية الشراء')
            .setDescription(`عذراً، رصيدك في المحفظة غير كافٍ لإتمام هذه الصفقة.`)
            .addFields(
              { name: '👛 رصيدك الحالي', value: `\`${profile.wallet.toLocaleString()} $\``, inline: true },
              { name: '💸 التكلفة المطلوبة', value: `\`${totalCost.toLocaleString()} $\``, inline: true }
            )
            .setTimestamp();

          await interaction.update({
            embeds: [errorEmbed],
            components: []
          });
          return;
        }

        // Check maximum capacity limit
        if (currentQty + qty > 100) {
          activeSessions.delete(message.author.id);
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000) // Red bar indicating capacity failure
            .setTitle('❌ تجاوز الحد الأقصى للمخزون')
            .setDescription(`لا يمكنك امتلاك أكثر من **100 حبة** من هذا العنصر.`)
            .addFields(
              { name: '📦 مخزونك الحالي', value: `\`${currentQty} / 100\``, inline: true },
              { name: '🔢 إجمالي الشحنة الجديدة', value: `\`${currentQty + qty} / 100\``, inline: true }
            )
            .setTimestamp();

          await interaction.update({
            embeds: [errorEmbed],
            components: []
          });
          return;
        }

        // Process purchase transaction
        const balanceBefore = profile.wallet;
        profile.wallet -= totalCost;
        profile.inventory[selectedItem.id as keyof typeof profile.inventory] = currentQty + qty;

        activeSessions.delete(message.author.id);

        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00) // Green bar indicating success
          .setTitle('✅ تمت عملية الشراء بنجاح!')
          .setDescription(`لقد قمت بإتمام الصفقة بنجاح عبر **Fire Bank** بالأسعار الحالية للسوق العالمي.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          .addFields(
            { name: '📦 العنصر المطلوب', value: `\`${selectedItem.emoji} ${selectedItem.name} × ${qty.toLocaleString()} حبة\``, inline: false },
            { name: '💰 سعر الوحدة الحالي', value: `\`${selectedItem.currentPrice.toLocaleString()} $\``, inline: true },
            { name: '💸 إجمالي تكلفة الصفقة', value: `\`${totalCost.toLocaleString()} $\``, inline: true },
            { name: '💳 رصيدك قبل الشراء', value: `\`${balanceBefore.toLocaleString()} $\``, inline: false },
            { name: '👛 رصيدك الحالي بعد شراء العناصر', value: `\`${profile.wallet.toLocaleString()} $\``, inline: false }
          )
          .setFooter({ text: 'شكراً لتعاملك مع سوق فاير بانك المالي' })
          .setTimestamp();

        await interaction.update({
          embeds: [successEmbed],
          components: []
        });
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          activeSessions.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ انتهى وقت الجلسة')
            .setDescription('انتهت الـ 60 ثانية دون اختيار السلعة. تم إلغاء عملية الشراء تلقائياً.')
            .setTimestamp();

          await responseMsg.edit({
            embeds: [timeoutEmbed],
            components: []
          });
        }
      });

      return;
    }

    // 3. Command: بيع [الكمية]
    if (content.startsWith('بيع')) {
      const sellMatch = content.match(/^بيع\s+(\d+)$/);
      if (!sellMatch) {
        await message.reply('⚠️ **طريقة كتابة الأمر:** بيع [الكمية]\n*(مثال: بيع 3)*');
        return;
      }

      const qty = parseInt(sellMatch[1], 10);
      if (isNaN(qty) || qty <= 0) {
        await message.reply('❌ الرجاء كتابة كمية صحيحة وأكبر من الصفر.');
        return;
      }

      if (activeSessions.has(message.author.id)) {
        await message.reply('⚠️ **لديك عملية شراء أو بيع معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.');
        return;
      }

      if (!await checkCooldown(message.author.id, 'بيع', message)) return;

      activeSessions.add(message.author.id);

      const guildIconUrl = message.guild.iconURL({ size: 256 });
      const embed = getMarketEmbed(guildIconUrl);
      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('sell_select_item')
        .setPlaceholder('اختر السلعة التي ترغب ببيعها من هنا...')
        .addOptions(
          marketItems.map(item => ({
            label: item.name,
            value: item.id,
            emoji: item.emoji,
            description: `السعر الحالي: ${item.currentPrice.toLocaleString()} $`
          }))
        );

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      
      const responseMsg = await message.reply({
        embeds: [embed],
        components: [row]
      });

      const filter = (i: any) => i.customId === 'sell_select_item' && i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        componentType: ComponentType.StringSelect,
        time: 60000
      });

      collector.on('collect', async (interaction) => {
        const selectedId = interaction.values[0];
        const selectedItem = marketItems.find(item => item.id === selectedId);

        if (!selectedItem) {
          activeSessions.delete(message.author.id);
          collector.stop();
          await interaction.reply({ content: '❌ حدث خطأ، لم يتم العثور على العنصر.', ephemeral: true });
          return;
        }

        collector.stop();

        const profile = getUserProfile(message.author.id);
        const currentQty = profile.inventory[selectedItem.id as keyof typeof profile.inventory] || 0;

        // Check if user owns enough of the item to sell
        if (currentQty < qty) {
          activeSessions.delete(message.author.id);
          const errorEmbed = new EmbedBuilder()
            .setColor(0xFF0000) // Red bar indicating lack of items
            .setTitle('❌ أنت لا تمتلك عدد كافي')
            .setDescription(`عذراً، أنت لا تمتلك الكمية الكافية من هذا العنصر لإتمام البيع.`)
            .addFields(
              { name: '📦 مخزونك الحالي', value: `\`${currentQty} / 100\``, inline: true },
              { name: '🔢 الكمية المطلوبة للبيع', value: `\`${qty}\``, inline: true }
            )
            .setTimestamp();

          await interaction.update({
            embeds: [errorEmbed],
            components: []
          });
          return;
        }

        // Process sell transaction
        const totalEarnings = selectedItem.currentPrice * qty;
        const balanceBefore = profile.wallet;
        profile.wallet += totalEarnings;
        profile.inventory[selectedItem.id as keyof typeof profile.inventory] = currentQty - qty;

        activeSessions.delete(message.author.id);

        const successEmbed = new EmbedBuilder()
          .setColor(0x00FF00) // Green bar indicating success
          .setTitle('✅ تمت عملية البيع بنجاح!')
          .setDescription(`لقد قمت بإتمام صفقة البيع بنجاح عبر **Fire Bank** بالأسعار الحالية للسوق العالمي.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━`)
          .addFields(
            { name: '📦 العنصر المبيع', value: `\`${selectedItem.emoji} ${selectedItem.name} × ${qty.toLocaleString()} حبة\``, inline: false },
            { name: '💰 سعر الوحدة الحالي', value: `\`${selectedItem.currentPrice.toLocaleString()} $\``, inline: true },
            { name: '💸 إجمالي أرباح الصفقة', value: `\`${totalEarnings.toLocaleString()} $\``, inline: true },
            { name: '💳 رصيدك قبل البيع', value: `\`${balanceBefore.toLocaleString()} $\``, inline: false },
            { name: '👛 رصيدك الحالي بعد بيع العناصر', value: `\`${profile.wallet.toLocaleString()} $\``, inline: false }
          )
          .setFooter({ text: 'شكراً لتعاملك مع سوق فاير بانك المالي' })
          .setTimestamp();

        await interaction.update({
          embeds: [successEmbed],
          components: []
        });
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          activeSessions.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ انتهى وقت الجلسة')
            .setDescription('انتهت الـ 60 ثانية دون اختيار السلعة. تم إلغاء عملية البيع تلقائياً.')
            .setTimestamp();

          await responseMsg.edit({
            embeds: [timeoutEmbed],
            components: []
          });
        }
      });

      return;
    }

    // 4. Command: نهب @اسم_الضحية
    if (content.startsWith('نهب')) {
      const robMatch = content.match(/^نهب\s+(<@!?\d+>)$/);
      if (!robMatch) {
        await message.reply('⚠️ **طريقة كتابة الأمر:** نهب @اسم_الضحية');
        return;
      }

      const victimId = robMatch[1].replace(/[<@!>]/g, '');
      
      if (victimId === message.author.id) {
        await message.reply('❌ لا يمكنك نهب نفسك!');
        return;
      }

      const victimProfile = getUserProfile(victimId);
      const robberProfile = getUserProfile(message.author.id);

      // Verify that victim has at least 5000 $
      if (victimProfile.wallet < 5000) {
        await message.reply('❌ ممنوع نهب شخص رصيده اقل من 5 الاف.');
        return;
      }

      if (!await checkCooldown(message.author.id, 'نهب', message)) return;

      // Roll a random rob amount between 1,000 $ and 10,000 $
      const maxRob = Math.min(10000, victimProfile.wallet);
      const minRob = 1000;
      
      let robAmount = 0;
      if (maxRob < minRob) {
        robAmount = victimProfile.wallet;
      } else {
        robAmount = Math.floor(Math.random() * (maxRob - minRob + 1)) + minRob;
      }

      // Deduct from victim and add to robber
      victimProfile.wallet -= robAmount;
      robberProfile.wallet += robAmount;

      await message.reply(`⚔️ **نجحت عملية النهب!**\nلقد قمت بنهب \`${robAmount.toLocaleString()} $\` من محفظة <@${victimId}>.`);
      return;
    }



    // 7. Command: ممتلكات
    if (content === 'ممتلكات') {
      const profile = getUserProfile(message.author.id);
      const guildIconUrl = message.guild.iconURL({ size: 256 });
      
      let totalInventoryValue = 0;
      const itemsFields: string[] = [];
      
      for (const item of marketItems) {
        const qty = profile.inventory[item.id as keyof typeof profile.inventory] || 0;
        if (qty > 0) {
          const itemValue = qty * item.currentPrice;
          totalInventoryValue += itemValue;
          itemsFields.push(
            `• ${item.emoji} **${item.name}**: \`${qty.toLocaleString('en-US')}\` حبة (بقيمة \`${itemValue.toLocaleString('en-US')} $\`)`
          );
        }
      }
      
      const totalWealth = profile.wallet + profile.bank + totalInventoryValue;
      
      const embed = new EmbedBuilder()
        .setColor(0x2b2d31)
        .setTitle('📋 قائمة ممتلكاتك وأصولك المالية | Fire Bank')
        .setDescription(`مرحباً بك <@${message.author.id}>، إليك كشف حسابك المالي وممتلكاتك بالتفصيل:`)
        .addFields(
          { 
            name: '👛 الرصيد في المحفظة', 
            value: `\`${profile.wallet.toLocaleString('en-US')} $\``, 
            inline: true 
          },
          { 
            name: '🏦 الرصيد في البنك', 
            value: `\`${profile.bank.toLocaleString('en-US')} $\``, 
            inline: true 
          },
          { 
            name: '💰 إجمالي الثروة', 
            value: `\`${totalWealth.toLocaleString('en-US')} $\``, 
            inline: true 
          },
          { 
            name: '📦 الممتلكات والسلع المخزنة', 
            value: itemsFields.length > 0 ? itemsFields.join('\n') : 'لا تمتلك أي سلع في مخزونك حالياً.', 
            inline: false 
          }
        )
        .setTimestamp();

      if (guildIconUrl) {
        embed.setThumbnail(guildIconUrl);
      }

      await message.reply({ embeds: [embed] });
      return;
    }

    // 8. Command: لعبة
    if (content === 'لعبة' || content === 'لعبه') {
      if (activeGames.has(message.author.id)) {
        await message.reply('⚠️ **لديك لعبة نشطة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.');
        return;
      }

      if (!await checkCooldown(message.author.id, 'لعبة', message)) return;

      activeGames.add(message.author.id);

      const rpsEmbed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('✊ لعبة حجرة ورقة مقص ✌️')
        .setDescription([
          `لقد بدأت لعبة حجرة ورقة مقص ضد البوت!`,
          `الرجاء كتابة **حجرة** أو **ورقة** أو **مقص** في الدردشة الآن.`,
          ``,
          `⏳ لديك **20 ثانية** للرد!`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n'))
        .setTimestamp();

      await message.reply({ embeds: [rpsEmbed] });

      const rpsCollector = message.channel.createMessageCollector({
        filter: (m: Message) => m.author.id === message.author.id && ['حجرة', 'ورقة', 'مقص'].includes(m.content.trim()),
        time: 20000,
        max: 1
      });

      rpsCollector.on('collect', async (m) => {
        const userChoice = m.content.trim();
        const choices = ['حجرة', 'ورقة', 'مقص'];
        const botChoice = choices[Math.floor(Math.random() * choices.length)];

        let result: 'win' | 'lose' | 'draw' = 'draw';
        if (userChoice === botChoice) {
          result = 'draw';
        } else if (
          (userChoice === 'حجرة' && botChoice === 'مقص') ||
          (userChoice === 'ورقة' && botChoice === 'حجرة') ||
          (userChoice === 'مقص' && botChoice === 'ورقة')
        ) {
          result = 'win';
        } else {
          result = 'lose';
        }

        const resultEmbed = new EmbedBuilder().setTimestamp();

        if (result === 'win') {
          const profile = getUserProfile(message.author.id);
          const reward = calculateGameReward(profile.wallet);
          profile.wallet += reward;

          resultEmbed
            .setColor(0x00FF00)
            .setTitle('🎉 فوز ساحق في حجرة ورقة مقص!')
            .setDescription([
              `• **اختيارك:** \`${userChoice}\``,
              `• **اختيار البوت:** \`${botChoice}\``,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `🏆 **لقد فزت بمكافأة:** \`${reward.toLocaleString('en-US')} $\``,
              `• **رصيد محفظتك الجديد:** \`${profile.wallet.toLocaleString('en-US')} $\``
            ].join('\n'));
        } else if (result === 'lose') {
          resultEmbed
            .setColor(0xFF0000)
            .setTitle('❌ خسارة في حجرة ورقة مقص!')
            .setDescription([
              `• **اختيارك:** \`${userChoice}\``,
              `• **اختيار البوت:** \`${botChoice}\``,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `حظاً موفقاً في المرة القادمة!`
            ].join('\n'));
        } else {
          resultEmbed
            .setColor(0x808080)
            .setTitle('🤝 تعادل في حجرة ورقة مقص!')
            .setDescription([
              `• **اختيارك:** \`${userChoice}\``,
              `• **اختيار البوت:** \`${botChoice}\``,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `لقد اخترتم نفس الشيء، العب مرة أخرى!`
            ].join('\n'));
        }

        activeGames.delete(message.author.id);
        await m.reply({ embeds: [resultEmbed] });
      });

      rpsCollector.on('end', async (collected) => {
        activeGames.delete(message.author.id);
        if (collected.size === 0) {
          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ انتهى وقت اللعبة')
            .setDescription('انتهت الـ 20 ثانية ولم تقم بكتابة اختيارك (حجرة، ورقة، مقص). تم إلغاء اللعبة.')
            .setTimestamp();

          await message.reply({ embeds: [timeoutEmbed] });
        }
      });

      return;
    }

    // 11. Command: مؤقت
    if (content === 'مؤقت') {
      const userId = message.author.id;
      const now = Date.now();
      const cooldownAmount = 60 * 1000; // 60 seconds

      if (cooldowns.has(userId)) {
        const expirationTime = cooldowns.get(userId)!;
        if (now < expirationTime) {
          const timeLeft = Math.ceil((expirationTime - now) / 1000);
          await message.reply(`❌ **عذراً، هذا الأمر في فترة التبريد!**\nيرجى الانتظار \`${timeLeft.toLocaleString('en-US')}\` ثانية قبل المحاولة مجدداً.`);
          return;
        }
      }

      // Set new cooldown
      const nextUsageTime = now + cooldownAmount;
      cooldowns.set(userId, nextUsageTime);

      const targetTimestamp = Math.floor(nextUsageTime / 1000);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('⏳ بدأ العد التنازلي!')
        .setDescription([
          `تم تفعيل الأمر بنجاح.`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
          `⏰ **يمكنك استخدام الأمر مجدداً بعد:** <t:${targetTimestamp}:R>`,
        ].join('\n'))
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      return;
    }

    // 12. Command: تداول [المبلغ]
    if (content.startsWith('تداول')) {
      const match = content.match(/^تداول\s+(\d+)$/);
      if (!match) {
        await message.reply('⚠️ **طريقة كتابة الأمر:** تداول [المبلغ]\n*(مثال: تداول 50000)*');
        return;
      }

      const amount = parseInt(match[1], 10);
      if (isNaN(amount) || amount <= 0) {
        await message.reply('❌ الرجاء إدخال مبلغ صحيح وأكبر من الصفر.');
        return;
      }

      if (amount < 5000) {
        await message.reply('❌ **لا يمكن تداول مبلغ أقل من 5,000 $!**');
        return;
      }

      const profile = getUserProfile(message.author.id);
      if (profile.wallet < amount) {
        await message.reply('❌ رصيدك في المحفظة غير كافٍ لإجراء هذه الصفقة.');
        return;
      }

      if (activeSessions.has(message.author.id)) {
        await message.reply('⚠️ **لديك عملية معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.');
        return;
      }

      if (!await checkCooldown(message.author.id, 'تداول', message)) return;

      activeSessions.add(message.author.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('🪙 منصة تداول العملات الرقمية | Fire Bank')
        .setDescription([
          `المبلغ المخصص للتداول: **${amount.toLocaleString('en-US')} $**`,
          `الرجاء اختيار العملة الرقمية التي ترغب في التداول بها من القائمة أدناه:`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n'))
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('trade_select_crypto')
        .setPlaceholder('اختر العملة الرقمية للتداول...')
        .addOptions([
          { label: 'بتكوين (Bitcoin - BTC) 🪙', value: 'btc', description: 'العملة الرقمية الأكبر والأكثر ثباتاً' },
          { label: 'إيثيريوم (Ethereum - ETH) 🔷', value: 'eth', description: 'منصة العقود الذكية الرائدة' },
          { label: 'سولانا (Solana - SOL) 🪙', value: 'sol', description: 'الشبكة الفائقة السرعة ومنخفضة التكلفة' },
          { label: 'دوج كوين (Dogecoin - DOGE) 🐕', value: 'doge', description: 'عملة الميمز الشهيرة ذات التقلبات العالية' }
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      
      const responseMsg = await message.reply({
        embeds: [embed],
        components: [row]
      });

      const filter = (i: any) => i.customId === 'trade_select_crypto' && i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        componentType: ComponentType.StringSelect,
        time: 60000
      });

      collector.on('collect', async (interaction) => {
        const selectedCrypto = interaction.values[0];
        const cryptoNames: { [key: string]: string } = {
          'btc': 'بتكوين (BTC)',
          'eth': 'إيثيريوم (ETH)',
          'sol': 'سولانا (SOL)',
          'doge': 'دوج كوين (DOGE)'
        };

        collector.stop();
        activeSessions.delete(message.author.id);

        const isWin = Math.random() > 0.5;
        const resultEmbed = new EmbedBuilder().setTimestamp();

        // Deduct initial amount
        profile.wallet -= amount;

        if (isWin) {
          const profitPercent = Math.floor(Math.random() * 101) + 20; 
          const profit = Math.round(amount * (profitPercent / 100));
          const totalReturned = amount + profit;
          profile.wallet += totalReturned;

          resultEmbed
            .setColor(0x00FF00)
            .setTitle('🚀 صفقة تداول ناجحة!')
            .setDescription([
              `لقد قمت بالتداول في عملة **${cryptoNames[selectedCrypto]}** بنجاح!`,
              `شهد السوق ارتفاعاً حاداً لأسعار العملات الرقمية.`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `• **مبلغ التداول:** \`${amount.toLocaleString('en-US')} $\``,
              `• **نسبة الصعود:** \`+${profitPercent}%\``,
              `• **الأرباح المحققة:** \`+${profit.toLocaleString('en-US')} $\``,
              `• **المبلغ الكلي المسترد:** \`${totalReturned.toLocaleString('en-US')} $\``,
              `👛 **رصيد محفظتك الحالي:** \`${profile.wallet.toLocaleString('en-US')} $\``
            ].join('\n'));
        } else {
          const lossPercent = Math.floor(Math.random() * 71) + 10; 
          const loss = Math.round(amount * (lossPercent / 100));
          const totalReturned = amount - loss;
          profile.wallet += totalReturned;

          resultEmbed
            .setColor(0xFF0000)
            .setTitle('📉 تراجع في صفقة التداول!')
            .setDescription([
              `لقد قمت بالتداول في عملة **${cryptoNames[selectedCrypto]}**!`,
              `شهد السوق موجة هبوط مفاجئة أدت إلى خسارة جزء من قيمة التداول.`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `• **مبلغ التداول:** \`${amount.toLocaleString('en-US')} $\``,
              `• **نسبة الهبوط:** \`-${lossPercent}%\``,
              `• **الخسارة المترتبة:** \`-${loss.toLocaleString('en-US')} $\``,
              `• **المبلغ المتبقي المسترد:** \`${totalReturned.toLocaleString('en-US')} $\``,
              `👛 **رصيد محفظتك الحالي:** \`${profile.wallet.toLocaleString('en-US')} $\``
            ].join('\n'));
        }

        await interaction.update({
          embeds: [resultEmbed],
          components: []
        });
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          activeSessions.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ انتهى وقت الجلسة')
            .setDescription('انتهت الـ 60 ثانية دون اختيار أي عملة تداول. تم إلغاء الصفقة.')
            .setTimestamp();

          await responseMsg.edit({
            embeds: [timeoutEmbed],
            components: []
          });
        }
      });

      return;
    }

    // 13. Command: استثمار [المبلغ]
    if (content.startsWith('استثمار')) {
      const match = content.match(/^استثمار\s+(\d+)$/);
      if (!match) {
        await message.reply('⚠️ **طريقة كتابة الأمر:** استثمار [المبلغ]\n*(مثال: استثمار 100000)*');
        return;
      }

      const amount = parseInt(match[1], 10);
      if (isNaN(amount) || amount <= 0) {
        await message.reply('❌ الرجاء إدخال مبلغ صحيح وأكبر من الصفر.');
        return;
      }

      if (amount < 5000) {
        await message.reply('❌ **لا يمكن استثمار مبلغ أقل من 5,000 $!**');
        return;
      }

      const profile = getUserProfile(message.author.id);
      if (profile.wallet < amount) {
        await message.reply('❌ رصيدك في المحفظة غير كافٍ لإجراء هذا الاستثمار.');
        return;
      }

      if (activeSessions.has(message.author.id)) {
        await message.reply('⚠️ **لديك عملية معلقة بالفعل!** يرجى إتمامها أو انتظار انتهائها أولاً.');
        return;
      }

      if (!await checkCooldown(message.author.id, 'استثمار', message)) return;

      activeSessions.add(message.author.id);

      const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('📈 منصة الاستثمار للشركات الكبرى | Fire Bank')
        .setDescription([
          `المبلغ المخصص للاستثمار: **${amount.toLocaleString('en-US')} $**`,
          `الرجاء اختيار الشركة التي ترغب في استثمار أموالك بها من القائمة أدناه:`,
          `━━━━━━━━━━━━━━━━━━━━━━━━━━`
        ].join('\n'))
        .setTimestamp();

      const selectMenu = new StringSelectMenuBuilder()
        .setCustomId('invest_select_company')
        .setPlaceholder('اختر الشركة للاستثمار...')
        .addOptions([
          { label: 'جوجل (Google) 🌐', value: 'google', description: 'عملاق التكنولوجيا والذكاء الاصطناعي العالمي' },
          { label: 'مايكروسوفت (Microsoft) 💻', value: 'microsoft', description: 'رائدة البرمجيات والخدمات السحابية' },
          { label: 'أبل (Apple) 🍏', value: 'apple', description: 'الشركة الرائدة في مجال الأجهزة الذكية' },
          { label: 'تيسلا (Tesla) 🚗', value: 'tesla', description: 'الشركة الأبرز في صناعة السيارات الكهربائية والطاقة' },
          { label: 'أمازون (Amazon) 🛍️', value: 'amazon', description: 'رائد التجارة الإلكترونية والخدمات التقنية' }
        ]);

      const row = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
      
      const responseMsg = await message.reply({
        embeds: [embed],
        components: [row]
      });

      const filter = (i: any) => i.customId === 'invest_select_company' && i.user.id === message.author.id;
      const collector = responseMsg.createMessageComponentCollector({
        filter,
        componentType: ComponentType.StringSelect,
        time: 60000
      });

      collector.on('collect', async (interaction) => {
        const selectedCompany = interaction.values[0];
        const companyNames: { [key: string]: string } = {
          'google': 'جوجل (Google)',
          'microsoft': 'مايكروسوفت (Microsoft)',
          'apple': 'أبل (Apple)',
          'tesla': 'تيسلا (Tesla)',
          'amazon': 'أمازون (Amazon)'
        };

        collector.stop();
        activeSessions.delete(message.author.id);

        const isWin = Math.random() < 0.7;
        const resultEmbed = new EmbedBuilder().setTimestamp();

        // Deduct initial amount
        profile.wallet -= amount;

        if (isWin) {
          const profitPercent = Math.floor(Math.random() * 41) + 10; 
          const profit = Math.round(amount * (profitPercent / 100));
          const totalReturned = amount + profit;
          profile.wallet += totalReturned;

          resultEmbed
            .setColor(0x00FF00)
            .setTitle('📈 استثمار ناجح وأرباح محققة!')
            .setDescription([
              `لقد قمت بالاستثمار في شركة **${companyNames[selectedCompany]}** بنجاح!`,
              `حققت الشركة نتائج مالية استثنائية هذا الربع مما رفع قيمة أسهمها.`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `• **المبلغ المستثمر:** \`${amount.toLocaleString('en-US')} $\``,
              `• **نسبة الصعود:** \`+${profitPercent}%\``,
              `• **الأرباح المحققة:** \`+${profit.toLocaleString('en-US')} $\``,
              `• **المبلغ الكلي المسترد:** \`${totalReturned.toLocaleString('en-US')} $\``,
              `👛 **رصيد محفظتك الحالي:** \`${profile.wallet.toLocaleString('en-US')} $\``
            ].join('\n'));
        } else {
          const lossPercent = Math.floor(Math.random() * 26) + 5; 
          const loss = Math.round(amount * (lossPercent / 100));
          const totalReturned = amount - loss;
          profile.wallet += totalReturned;

          resultEmbed
            .setColor(0xFF0000)
            .setTitle('📉 تراجع في قيمة الاستثمار!')
            .setDescription([
              `لقد قمت بالاستثمار في شركة **${companyNames[selectedCompany]}**!`,
              `تأثرت أسهم الشركة مؤقتاً بتقلبات السوق العالمي والاقتصاد.`,
              `━━━━━━━━━━━━━━━━━━━━━━━━━━`,
              `• **المبلغ المستثمر:** \`${amount.toLocaleString('en-US')} $\``,
              `• **نسبة الهبوط:** \`-${lossPercent}%\``,
              `• **الخسارة المترتبة:** \`-${loss.toLocaleString('en-US')} $\``,
              `• **المبلغ المتبقي المسترد:** \`${totalReturned.toLocaleString('en-US')} $\``,
              `👛 **رصيد محفظتك الحالي:** \`${profile.wallet.toLocaleString('en-US')} $\``
            ].join('\n'));
        }

        await interaction.update({
          embeds: [resultEmbed],
          components: []
        });
      });

      collector.on('end', async (collected, reason) => {
        if (reason === 'time' && collected.size === 0) {
          activeSessions.delete(message.author.id);
          const timeoutEmbed = new EmbedBuilder()
            .setColor(0xFF0000)
            .setTitle('❌ انتهى وقت الجلسة')
            .setDescription('انتهت الـ 60 ثانية دون اختيار أي شركة للاستثمار. تم إلغاء العملية.')
            .setTimestamp();

          await responseMsg.edit({
            embeds: [timeoutEmbed],
            components: []
          });
        }
      });

      return;
    }

    // 14. Command: تصفير / تصفير @العضو
    if (content.startsWith('تصفير')) {
      const isConfigOwner = message.author.id === message.guild.ownerId || message.member?.permissions.has('Administrator');
      if (!isConfigOwner) {
        await message.reply('❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**');
        return;
      }

      const match = content.match(/^تصفير\s+(<@!?\d+>)$/);
      if (match) {
        const targetId = match[1].replace(/[<@!>]/g, '');
        userProfiles.delete(targetId);
        await message.reply(`✅ **تم تصفير رصيد وممتلكات العضو <@${targetId}> بنجاح!**`);
      } else if (content === 'تصفير') {
        userProfiles.clear();
        await message.reply('✅ **تم تصفير جميع أرصدة وممتلكات الحسابات في البوت بنجاح!**');
      } else {
        await message.reply('⚠️ **طريقة كتابة الأمر:**\n• لتصفير الكل: `تصفير`\n• لتصفير عضو محدد: `تصفير @العضو`');
      }
      return;
    }

    // 15. Command: /abb-channel [منشن الرومات]
    if (content.startsWith('/abb-channel') || content.startsWith('abb-channel')) {
      const isConfigOwner = message.author.id === message.guild.ownerId || message.member?.permissions.has('Administrator');
      if (!isConfigOwner) {
        await message.reply('❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**');
        return;
      }

      // Parse mentioned channels
      const channelMentions = message.mentions.channels;
      if (channelMentions.size === 0) {
        await message.reply('⚠️ **طريقة كتابة الأمر:**\n• `/abb-channel #روم1 #روم2 #روم3` (تحديد حتى 3 رومات)');
        return;
      }

      if (channelMentions.size > 3) {
        await message.reply('❌ **خطأ:** لا يمكن تفعيل البوت في أكثر من 3 رومات!');
        return;
      }

      const tempChannels = Array.from(channelMentions.keys());
      allowedChannels = tempChannels;
      saveAllowedChannels(allowedChannels);

      const channelListString = allowedChannels.map(id => `<#${id}>`).join(' ، ');
      await message.reply(`✅ **تم تفعيل البوت بنجاح في الغرف المحددة:**\n• ${channelListString}\n*(لن يستجيب البوت لأي أمر خارج هذه الغرف)*`);
      return;
    }

    // 16. Command: @Bot room #channel
    if (isRoomConfigMention) {
      const isConfigOwner = message.author.id === message.guild.ownerId || message.member?.permissions.has('Administrator');
      if (!isConfigOwner) {
        await message.reply('❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**');
        return;
      }

      const botMentionRegex = new RegExp(`^<@!?${client.user?.id}>\\s+room\\s+<#(\\d+)>`, 'i');
      const mentionMatch = content.match(botMentionRegex);

      if (!mentionMatch) {
        await message.reply('⚠️ **طريقة كتابة الأمر:**\n• `@البوت room #الروم`');
        return;
      }

      const targetChannelId = mentionMatch[1];
      allowedChannels = [targetChannelId];
      saveAllowedChannels(allowedChannels);

      await message.reply(`تم تفعيل البوت في <#${targetChannelId}>`);
      return;
    }

    // 17. Command: @Bot روم [اسم الروم أو منشن] (Arabic unlink/link management)
    if (isArabicRoomMention) {
      const isConfigOwner = message.author.id === message.guild?.ownerId || message.member?.permissions.has('Administrator');
      if (!isConfigOwner) {
        await message.reply('❌ **هذا الأمر مخصص لمدراء السيرفر فقط!**');
        return;
      }

      // Remove the bot mention prefix and clean up
      let cleanContent = content;
      if (cleanContent.startsWith(botMentionPrefix)) {
        cleanContent = cleanContent.slice(botMentionPrefix.length).trim();
      } else if (cleanContent.startsWith(botMentionPrefixNick)) {
        cleanContent = cleanContent.slice(botMentionPrefixNick.length).trim();
      }

      // We expect the word "روم" at the start
      if (cleanContent.startsWith('روم')) {
        const roomArg = cleanContent.slice(3).trim(); // Remove "روم"

        if (!roomArg) {
          await message.reply('⚠️ **طريقة كتابة الأمر:**\n• `@البوت روم #الروم` أو `@البوت روم اسم_الروم`');
          return;
        }

        let targetChannelId: string | null = null;

        // 1. Try matching Discord channel mention: <#123456789>
        const mentionMatch = roomArg.match(/^&?lt;#(\d+)&?gt;/i) || roomArg.match(/^<#(\d+)>/);
        const rawMentionMatch = roomArg.match(/^<#(\d+)>$/);
        if (rawMentionMatch) {
          targetChannelId = rawMentionMatch[1];
        } else {
          // 2. Try to find the channel in the guild by name or ID
          if (message.guild) {
            const channels = message.guild.channels.cache;
            // Clean roomArg if it starts with # for name lookup
            let searchName = roomArg;
            if (searchName.startsWith('#')) {
              searchName = searchName.slice(1);
            }

            // Try finding by name (exact match, case insensitive)
            let foundChannel = channels.find(c => c.name.toLowerCase() === searchName.toLowerCase() && c.isTextBased());
            if (!foundChannel && /^\d+$/.test(roomArg)) {
              // Try by ID
              foundChannel = channels.get(roomArg);
            }
            if (foundChannel) {
              targetChannelId = foundChannel.id;
            }
          }
        }

        if (!targetChannelId) {
          await message.reply('❌ **لم يتم العثور على القناة المحددة.** يرجى التأكد من اسم القناة أو عمل منشن لها.');
          return;
        }

        // Check if the channel is currently linked
        if (allowedChannels.includes(targetChannelId)) {
          // Remove from allowedChannels
          allowedChannels = allowedChannels.filter(id => id !== targetChannelId);
          saveAllowedChannels(allowedChannels);
          await message.reply(`✅ تم إلغاء ارتباط البوت بنجاح عن الروم: <#${targetChannelId}>`);
        } else {
          await message.reply('❌ **هذه القناة غير مرتبطة بالبوت حالياً.**');
        }
      }
      return;
    }
  } catch (error) {
    console.error('Error:', error);
  }
});

// Simple HTTP server to keep the bot alive on hosting platforms like Render
const port = process.env.PORT || 3000;
http.createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Fire Bank Bot is online!');
}).listen(port, () => {
  console.log(`🌍 HTTP server is listening on port ${port}`);
});

client.login(token);