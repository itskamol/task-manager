# Gemini AI Task Manager Setup Guide

This guide will help you set up the enhanced task manager with Gemini AI integration and comprehensive reporting.

## 🚀 Features Added

### 1. Gemini AI Integration

- **Smart Priority Analysis**: AI analyzes task content to suggest priority levels
- **Deadline Suggestions**: Intelligent deadline recommendations based on task complexity
- **Time Estimation**: AI estimates how long tasks will take
- **Schedule Optimization**: Smart scheduling suggestions
- **Behavior Analysis**: AI analyzes user patterns and provides insights

### 2. Comprehensive Reporting System

- **Daily Reports**: Today's tasks, productivity score, and insights
- **Weekly Reports**: Week overview with trends and recommendations
- **Monthly Reports**: Monthly progress and habit analysis
- **Quarterly Reports**: Quarterly goals and achievement analysis
- **Yearly Reports**: Annual productivity overview
- **Analytics**: Detailed productivity metrics and trends

### 3. New Bot Commands

- `/daily_report` - Get today's productivity report
- `/weekly_report` - Get this week's summary
- `/monthly_report` - Get this month's analysis
- `/quarterly_report` - Get quarterly overview
- `/yearly_report` - Get annual summary
- `/analytics` - Get detailed productivity analytics
- `/trend` - Get trend analysis and insights

## 🔧 Setup Instructions

### 1. Environment Configuration

Copy the example environment file and configure it:

```bash
cp .env.example .env
```

Edit `.env` and add your API keys:

```env
# Gemini AI API Key (Required for AI features)
GEMINI_API_KEY=your_gemini_api_key_here

# Telegram Bot Token
TELEGRAM_BOT_TOKEN=your_telegram_bot_token

# Database Configuration
DATABASE_URL="postgresql://username:password@localhost:5432/taskmanager"

# Redis Configuration
REDIS_URL="redis://localhost:6379"
```

### 2. Get Gemini API Key

1. Go to [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Sign in with your Google account
3. Click "Create API Key"
4. Copy the API key and paste it in your `.env` file

### 3. Install Dependencies

```bash
npm install
```

### 4. Database Setup

```bash
# Generate Prisma client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# (Optional) View database in Prisma Studio
npx prisma studio
```

### 5. Start the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## 🤖 Testing the AI Features

### Test AI Task Creation

```
/add Complete project documentation with examples and deployment guide
```

The AI will analyze this and suggest:

- Priority: HIGH (due to complexity)
- Deadline: Based on task scope
- Estimated time: Based on content analysis

### Test Reporting

```
/daily_report
```

Will show:

- Today's completed tasks
- Productivity score
- AI-generated insights in Uzbek
- Recommendations for improvement

### Test Analytics

```
/analytics
```

Will show:

- Productivity trends
- Task completion rates
- Category analysis
- Streak information

## 🔍 AI Prompts Used

The system uses sophisticated prompts in Uzbek to generate contextual insights:

### Priority Analysis

- Analyzes keywords like "urgent", "important", "deadline"
- Considers task complexity and scope
- Returns priority with reasoning

### Deadline Suggestions

- Considers task type and complexity
- Suggests realistic timeframes
- Factors in user's timezone

### Insights Generation

- Analyzes completion patterns
- Identifies productivity trends
- Provides actionable recommendations in Uzbek

## 🐛 Troubleshooting

### Common Issues

1. **Gemini API Errors**

    - Check if API key is correctly set in `.env`
    - Verify API key has proper permissions
    - Check internet connectivity

2. **Database Connection Issues**

    - Ensure PostgreSQL is running
    - Check DATABASE_URL format
    - Run `npx prisma migrate dev`

3. **Redis Connection Issues**
    - Ensure Redis is running
    - Check REDIS_URL format
    - Test with `redis-cli ping`

### Fallback Behavior

If Gemini AI is unavailable, the system automatically falls back to:

- Default priority assignment based on keywords
- Standard deadline calculations
- Basic time estimations
- Simple completion statistics

## 📊 Reports Structure

### Daily Report

- Tasks completed today
- Productivity score (0-100)
- Current streak
- AI insights in Uzbek
- Tomorrow's recommendations

### Weekly Report

- Week's completion rate
- Most productive days
- Category analysis
- Trend comparison
- AI-powered weekly insights

### Monthly Report

- Monthly productivity trends
- Goal achievement analysis
- Habit formation insights
- Category performance
- Monthly recommendations

## 🎯 Next Steps

1. **Configure Environment**: Set up all API keys and database connections
2. **Test Basic Features**: Create tasks and test AI suggestions
3. **Test Reporting**: Generate reports and review AI insights
4. **Customize Prompts**: Modify AI prompts for your specific needs
5. **Monitor Performance**: Check AI response times and accuracy

## 🔄 Continuous Improvement

The AI system learns from user patterns and can be enhanced by:

- Adjusting prompts based on user feedback
- Adding more sophisticated analysis algorithms
- Integrating additional data sources
- Expanding language support beyond Uzbek

---

**Note**: This system requires active internet connection for Gemini AI features. All AI features have fallback mechanisms for offline operation.
