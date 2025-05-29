import { Injectable } from '@nestjs/common';
import { Context } from 'grammy';
import { BotLoggerService } from '../services/bot-logger.service';
import { BotCommands } from '../config/commands';
import { BotKeyboards } from '../utils/keyboards';

@Injectable()
export class HelpHandler {
    constructor(private readonly logger: BotLoggerService) {}

    async handle(ctx: Context): Promise<void> {
        if (ctx.message?.text) {
            this.logger.commandReceived(ctx, ctx.message.text);
        }

        // Get help text from the new command system
        const helpText = this.getHelpText();

        await ctx.reply(helpText, {
            parse_mode: 'HTML',
            reply_markup: BotKeyboards.createHelpKeyboard(),
        });
        this.logger.messageReceived(ctx);
    }

    async handleTaskHelp(ctx: Context): Promise<void> {
        if (ctx.message?.text) {
            this.logger.commandReceived(ctx, ctx.message.text);
        }

        const taskHelpText = this.getTaskHelpText();
        await ctx.reply(taskHelpText, { parse_mode: 'HTML' });
        this.logger.messageReceived(ctx);
    }

    async handleReportHelp(ctx: Context): Promise<void> {
        if (ctx.message?.text) {
            this.logger.commandReceived(ctx, ctx.message.text);
        }

        const reportHelpText = this.getReportHelpText();
        await ctx.reply(reportHelpText, { parse_mode: 'HTML' });
        this.logger.messageReceived(ctx);
    }

    private getHelpText(): string {
        // Create dummy handlers for command generation
        const dummyCommands = BotCommands.createCommands({
            startHandler: null as any,
            contactHandler: null as any,
            helpHandler: null as any,
            tasksHandler: null as any,
            reportsHandler: null as any,
        });

        return BotCommands.generateHelpText(dummyCommands);
    }

    private getTaskHelpText(): string {
        return `📝 <b>Vazifa Boshqaruvi - Batafsil Yordam</b>

🆕 <b>Vazifa qo'shish (/add):</b>

<b>Oddiy vazifa:</b>
• <code>/add Kitob o'qish</code>
• <code>/add Do'konga borish</code>
• <code>/add Email javoblarini yozish</code>

<b>Muhim vazifalar (yuqori prioritet):</b>
• <code>/add Urgent mijoz bilan uchrashuv</code>
• <code>/add Critical bug'ni tuzatish</code>
• <code>/add Emergency prezentatsiya tayyorlash</code>

<b>Vaqt ko'rsatkichli vazifalar:</b>
• <code>/add Quick telefon qo'ng'irog'i</code>
• <code>/add Meeting boshqaruv bilan</code>
• <code>/add Simple email yuborish</code>

📋 <b>Vazifalarni ko'rish (/list):</b>
• Barcha vazifalaringizni ko'rish
• AI tomonidan optimallashtirilgan tartibda
• Prioritet va deadline bilan

🤖 <b>AI Yordamchisi nima qiladi:</b>

<b>1. Prioritet aniqlash:</b>
• "urgent", "asap", "critical" - Yuqori prioritet
• "important", "needed", "soon" - O'rta prioritet
• Boshqalar - Past prioritet

<b>2. Vaqt baholash:</b>
• "quick", "simple" - 30 daqiqa
• "meeting", "call" - 60 daqiqa
• Murakkab vazifalar - 120 daqiqa

<b>3. Deadline taklifi:</b>
• Yuqori prioritet - 24 soat
• O'rta prioritet - 3 kun
• Past prioritet - 1 hafta

✨ <b>Misollar:</b>

<code>/add Urgent client presentation tayyorlash</code>
→ Yuqori prioritet, 24 soat deadline, 120 daqiqa

<code>/add Quick email javobini yozish</code>
→ Past prioritet, 1 hafta deadline, 30 daqiqa

<code>/add Meeting marketing jamoasi bilan</code>
→ O'rta prioritet, 3 kun deadline, 60 daqiqa`;
    }

    private getReportHelpText(): string {
        return `📊 <b>Hisobotlar - Batafsil Yordam</b>

🗓️ <b>Vaqt bo'yicha hisobotlar:</b>

<b>/daily_report</b> - Kunlik hisobot
• Bugungi vazifalar tahlili
• Bajarilish foizi
• Samaradorlik bahosi
• AI takliflari
<i>Misol:</i> <code>/daily_report</code>

<b>/weekly_report</b> - Haftalik hisobot
• 7 kunlik faoliyat
• Haftalik tendentsiya
• Muvaffaqiyatlar va muammolar
<i>Misol:</i> <code>/weekly_report</code>

<b>/monthly_report</b> - Oylik hisobot
• Oylik natijalar
• Uzunmuddatli tendentsiyalar
• Maqsadlarga erishish darajasi
<i>Misol:</i> <code>/monthly_report</code>

<b>/quarterly_report</b> - Choraklik hisobot
• 3 oylik umumiy tahlil
• Strategik ko'rsatkichlar
• Katta maqsadlar bo'yicha progress
<i>Misol:</i> <code>/quarterly_report</code>

<b>/yearly_report</b> - Yillik hisobot
• Butun yillik natijalar
• Eng katta yutuqlar
• Keyingi yil uchun takliflar
<i>Misol:</i> <code>/yearly_report</code>

📈 <b>Tahlil va tendentsiyalar:</b>

<b>/analytics</b> - Shaxsiy tahlil
• Eng samarali kun va soat
• Izchillik ko'rsatkichlari
• Asosiy kategoriyalar
• Kunlik o'rtacha vazifalar
<i>Misol:</i> <code>/analytics</code>

<b>/trend</b> - Samaradorlik tendentsiyasi
• So'nggi 7 kunlik grafik
• Kunlik bajarilish foizi
• Samaradorlik o'zgarishi
<i>Misol:</i> <code>/trend</code>

📊 <b>Hisobotlarda nimalar bo'ladi:</b>

<b>1. Asosiy ko'rsatkichlar:</b>
• Jami vazifalar soni
• Bajarilgan vazifalar
• Bajarilish foizi
• Muddati o'tgan vazifalar

<b>2. Prioritet taqsimoti:</b>
• Yuqori prioritetli vazifalar
• O'rta prioritetli vazifalar
• Past prioritetli vazifalar

<b>3. AI tahlili:</b>
• Samaradorlik bahosi (0-100)
• Kuchli tomonlar
• Yaxshilash takliflari
• Shaxsiy maslahatlar

<b>4. Vaqt tahlili:</b>
• O'rtacha bajarish vaqti
• Eng samarali soatlar
• Izchillik ko'rsatkichlari

💡 <b>Foydalanish maslahatlari:</b>
• Kunlik hisobotni har kuni kechqurun ko'ring
• Haftalik hisobotni dushanba yoki yakshanba ko'ring
• Analytics'ni oyiga bir marta tekshiring
• Trend'ni har hafta kuzatib boring`;
    }
}
