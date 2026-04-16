#!/usr/bin/env python3
"""
Utility script to clear test data from the database.
Run this script to clean up existing test users and miners.
"""

import sys
import os

# Add the app directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), 'app'))

from app.database import SessionLocal, engine
from app.models import Base, User, Miner

def clear_test_data():
    """Clear test users and miners from the database."""
    
    db = SessionLocal()
    
    try:
        print("Clearing test data...")
        
        # Clear test users (except admin)
        test_emails = ['chazambira1112@gmail.com', 'test@example.com']
        
        for email in test_emails:
            user = db.query(User).filter(User.email == email).first()
            if user:
                print(f"Deleting user: {email}")
                db.delete(user)
        
        # Clear test miners with test registration numbers
        test_reg_numbers = ['DDD-DSU-1DDDH', 'COOP-SUV-200-200']
        
        for reg_num in test_reg_numbers:
            miner = db.query(Miner).filter(Miner.registration_ref == reg_num).first()
            if miner:
                print(f"Deleting miner: {reg_num}")
                db.delete(miner)
        
        db.commit()
        print("Test data cleared successfully!")
        
    except Exception as e:
        print(f"Error clearing test data: {e}")
        db.rollback()
        raise
    finally:
        db.close()

if __name__ == "__main__":
    clear_test_data()
