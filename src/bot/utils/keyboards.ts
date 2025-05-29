import { InlineKeyboard, Keyboard } from 'grammy';

/**
 * Utility class for creating interactive keyboards for the bot
 */
export class BotKeyboards {
    /**
     * Creates an inline keyboard for report commands
     * Used when user wants to access different types of reports
     */
    static createReportKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text('📅 Kunlik hisobot', 'daily_report')
            .text('📊 Haftalik hisobot', 'weekly_report')
            .row()
            .text('📈 Oylik hisobot', 'monthly_report')
            .text('📋 Choraklik hisobot', 'quarterly_report')
            .row()
            .text('📆 Yillik hisobot', 'yearly_report')
            .text('🔍 Tahlil', 'analytics')
            .row()
            .text('📉 Trend', 'trend')
            .text('❌ Bekor qilish', 'cancel');
    }

    /**
     * Creates an inline keyboard for help navigation
     * Allows users to quickly access specific help sections
     */
    static createHelpKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text('📝 Vazifa yordami', 'task_help')
            .text('📊 Hisobot yordami', 'report_help')
            .row()
            .text('🏠 Asosiy menuga qaytish', 'main_menu');
    }

    /**
     * Creates an inline keyboard for task actions
     * Displayed when listing tasks or after adding a task
     */
    static createTaskActionsKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text('➕ Yangi vazifa', 'add_task')
            .text("📋 Ro'yxat", 'list_tasks')
            .row()
            .text('✅ Bajarish', 'complete_task')
            .text('📊 Hisobot', 'reports');
    }

    /**
     * Creates a reply keyboard for quick access to main functions
     * Always visible to the user for easy navigation
     */
    static createMainMenuKeyboard(): Keyboard {
        return new Keyboard()
            .text("➕ Vazifa qo'shish")
            .text("📋 Vazifalar ro'yxati")
            .row()
            .text('📊 Kunlik hisobot')
            .text('🔍 Tahlil')
            .row()
            .text('🆘 Yordam')
            .text('⚙️ Sozlamalar')
            .resized()
            .persistent();
    }

    /**
     * Creates a simple confirmation keyboard
     * Used for confirming actions like task completion or deletion
     */
    static createConfirmationKeyboard(
        confirmAction: string,
        cancelAction: string = 'cancel',
    ): InlineKeyboard {
        return new InlineKeyboard().text('✅ Ha', confirmAction).text("❌ Yo'q", cancelAction);
    }

    /**
     * Creates priority selection keyboard for task creation
     */
    static createPriorityKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text('🔴 Yuqori', 'priority_high')
            .text("🟡 O'rta", 'priority_medium')
            .text('🟢 Past', 'priority_low')
            .row()
            .text('❌ Bekor qilish', 'cancel');
    }

    /**
     * Creates time estimation keyboard for task creation
     */
    static createTimeEstimationKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text('⚡ 15 daq', 'time_15')
            .text('🏃 30 daq', 'time_30')
            .text('🚶 1 soat', 'time_60')
            .row()
            .text('🕐 2 soat', 'time_120')
            .text('🕓 4+ soat', 'time_240')
            .text('❓ Bilmayman', 'time_unknown')
            .row()
            .text('❌ Bekor qilish', 'cancel');
    }

    /**
     * Creates a keyboard for report period selection
     */
    static createPeriodSelectionKeyboard(): InlineKeyboard {
        return new InlineKeyboard()
            .text('📅 Bugun', 'period_today')
            .text('📆 Kecha', 'period_yesterday')
            .row()
            .text('📊 Bu hafta', 'period_this_week')
            .text("📈 O'tgan hafta", 'period_last_week')
            .row()
            .text('📋 Bu oy', 'period_this_month')
            .text("📉 O'tgan oy", 'period_last_month')
            .row()
            .text('❌ Bekor qilish', 'cancel');
    }
}
