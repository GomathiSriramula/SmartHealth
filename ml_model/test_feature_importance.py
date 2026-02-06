"""
Test script to demonstrate feature importance extraction and analysis.

This script:
1. Loads a trained model
2. Extracts feature importances
3. Displays them with detailed explanations
4. Shows which factors are most critical for outbreak prediction
"""

import logging
from model import DiseaseOutbreakModel

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def main():
    """Test feature importance extraction."""
    logger.info("\n" + "="*80)
    logger.info("FEATURE IMPORTANCE DEMONSTRATION")
    logger.info("="*80 + "\n")
    
    try:
        # Initialize model
        model = DiseaseOutbreakModel()
        
        # Load trained model
        logger.info("Loading trained model...")
        model.load_model()
        
        # Get feature importances (sorted list)
        logger.info("\nExtracting feature importances...")
        importances = model.get_feature_importance()
        
        logger.info(f"\n✓ Extracted {len(importances)} features")
        logger.info(f"   Features: {[feat for feat, _ in importances]}")
        
        # Display detailed analysis
        logger.info("\nGenerating detailed feature importance analysis...")
        model.display_feature_importance()
        
        # Show top 3 features only
        logger.info("\n" + "="*80)
        logger.info("TOP 3 FEATURES SUMMARY")
        logger.info("="*80)
        
        for rank, (feature, importance) in enumerate(importances[:3], 1):
            total = sum(imp for _, imp in importances)
            pct = 100 * importance / total
            logger.info(f"\n{rank}. {feature}")
            logger.info(f"   Importance Score: {importance:.6f}")
            logger.info(f"   Relative Contribution: {pct:.1f}%")
        
        logger.info("\n" + "="*80 + "\n")
        
    except FileNotFoundError:
        logger.error("❌ No trained model found.")
        logger.error("   Please train a model first using: python train.py <csv_file>")
    except Exception as e:
        logger.error(f"❌ Error: {str(e)}")
        raise


if __name__ == "__main__":
    main()
