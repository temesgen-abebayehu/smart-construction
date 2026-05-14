"""
Quick script to add the weight column to tasks table
Run this with: python add_weight_column.py
"""
import asyncio
from sqlalchemy import text
from app.database.session import engine

async def add_weight_column():
    async with engine.begin() as conn:
        # Check if column exists
        result = await conn.execute(text("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name='tasks' AND column_name='weight'
        """))
        
        if result.fetchone() is None:
            print("Adding weight column to tasks table...")
            await conn.execute(text("""
                ALTER TABLE tasks 
                ADD COLUMN weight FLOAT NOT NULL DEFAULT 0.0
            """))
            print("✓ Weight column added successfully!")
        else:
            print("✓ Weight column already exists")

if __name__ == "__main__":
    asyncio.run(add_weight_column())
