#!/bin/bash

# Test script for Gemini AI Task Manager
echo "🚀 Testing Gemini AI Task Manager Setup"
echo "========================================"

# Check if .env file exists
if [ ! -f .env ]; then
    echo "❌ .env file not found. Please copy .env.example to .env and configure it."
    exit 1
fi

# Check for required environment variables
source .env

echo "🔍 Checking environment variables..."

if [ -z "$GEMINI_API_KEY" ]; then
    echo "⚠️  GEMINI_API_KEY not set in .env"
else
    echo "✅ GEMINI_API_KEY is configured"
fi

if [ -z "$TELEGRAM_BOT_TOKEN" ]; then
    echo "⚠️  TELEGRAM_BOT_TOKEN not set in .env"
else
    echo "✅ TELEGRAM_BOT_TOKEN is configured"
fi

if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set in .env"
else
    echo "✅ DATABASE_URL is configured"
fi

if [ -z "$REDIS_URL" ]; then
    echo "⚠️  REDIS_URL not set in .env"
else
    echo "✅ REDIS_URL is configured"
fi

echo ""
echo "🔧 Checking dependencies..."

# Check if node_modules exists
if [ ! -d "node_modules" ]; then
    echo "❌ Dependencies not installed. Running pnpm install..."
    pnpm install
else
    echo "✅ Dependencies are installed"
fi

# Check if @google/generative-ai is installed
if pnpm list @google/generative-ai > /dev/null 2>&1; then
    echo "✅ @google/generative-ai is installed"
else
    echo "❌ @google/generative-ai not found. Installing..."
    pnpm install @google/generative-ai
fi

# Check if date-fns is installed
if pnpm list date-fns > /dev/null 2>&1; then
    echo "✅ date-fns is installed"
else
    echo "❌ date-fns not found. Installing..."
    pnpm install date-fns
fi

echo ""
echo "🗄️  Checking database setup..."

# Check if Prisma client is generated
if [ -d "node_modules/.prisma" ]; then
    echo "✅ Prisma client is generated"
else
    echo "🔄 Generating Prisma client..."
    pnpm dlx prisma generate
fi

echo ""
echo "🏗️  Building the application..."
pnpm run build

if [ $? -eq 0 ]; then
    echo "✅ Application built successfully"
else
    echo "❌ Build failed. Please check the errors above."
    exit 1
fi

echo ""
echo "🎉 Setup verification complete!"
echo ""
echo "📋 Next steps:"
echo "1. Ensure PostgreSQL is running"
echo "2. Ensure Redis is running" 
echo "3. Run: pnpm dlx prisma migrate dev"
echo "4. Start the application: pnpm run start:dev"
echo ""
echo "🤖 New bot commands available:"
echo "• /daily_report - Get today's productivity report"
echo "• /weekly_report - Get this week's summary"
echo "• /monthly_report - Get this month's analysis"
echo "• /quarterly_report - Get quarterly overview"
echo "• /yearly_report - Get annual summary"
echo "• /analytics - Get detailed productivity analytics"
echo "• /trend - Get trend analysis and insights"
echo ""
echo "💡 AI Features:"
echo "• Smart priority analysis for new tasks"
echo "• Intelligent deadline suggestions"
echo "• Task duration estimation"
echo "• Schedule optimization"
echo "• Behavioral insights and recommendations"
