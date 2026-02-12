"""
SmartHealth Project Summary PDF Generator
==========================================
This script generates a professional PDF document from the interview-ready
project summary using the reportlab library.

Usage:
    python generate_project_summary_pdf.py

Output:
    Project_Summary.pdf (in the same directory)
"""

from reportlab.lib.pagesizes import letter, A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import inch
from reportlab.lib.enums import TA_LEFT, TA_CENTER, TA_JUSTIFY
from reportlab.lib.colors import HexColor, black, white
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, PageBreak, 
    Table, TableStyle, ListFlowable, ListItem, Preformatted,
    KeepTogether
)
from reportlab.lib import colors
from datetime import datetime


def create_custom_styles():
    """Create custom paragraph styles for the document"""
    styles = getSampleStyleSheet()
    
    # Title style
    styles.add(ParagraphStyle(
        name='CustomTitle',
        parent=styles['Heading1'],
        fontSize=24,
        textColor=HexColor('#1a365d'),
        spaceAfter=30,
        alignment=TA_CENTER,
        fontName='Helvetica-Bold'
    ))
    
    # Section Header
    styles.add(ParagraphStyle(
        name='SectionHeader',
        parent=styles['Heading1'],
        fontSize=16,
        textColor=HexColor('#2563eb'),
        spaceAfter=12,
        spaceBefore=20,
        fontName='Helvetica-Bold',
        borderWidth=1,
        borderColor=HexColor('#2563eb'),
        borderPadding=(5, 5, 5, 5),
        backColor=HexColor('#eff6ff')
    ))
    
    # Subsection Header
    styles.add(ParagraphStyle(
        name='SubsectionHeader',
        parent=styles['Heading2'],
        fontSize=14,
        textColor=HexColor('#1e40af'),
        spaceAfter=10,
        spaceBefore=15,
        fontName='Helvetica-Bold'
    ))
    
    # Normal text with justify
    styles.add(ParagraphStyle(
        name='JustifyBody',
        parent=styles['BodyText'],
        fontSize=10,
        alignment=TA_JUSTIFY,
        spaceAfter=12,
        leading=14
    ))
    
    # Bullet point style
    styles.add(ParagraphStyle(
        name='BulletPoint',
        parent=styles['BodyText'],
        fontSize=10,
        leftIndent=20,
        spaceAfter=6,
        leading=13
    ))
    
    # Code style
    styles.add(ParagraphStyle(
        name='CodeBlock',
        parent=styles['Code'],
        fontSize=8,
        leftIndent=30,
        rightIndent=30,
        spaceAfter=10,
        spaceBefore=10,
        backColor=HexColor('#f3f4f6'),
        borderWidth=1,
        borderColor=HexColor('#d1d5db'),
        borderPadding=(8, 8, 8, 8)
    ))
    
    # Emphasis style
    styles.add(ParagraphStyle(
        name='Emphasis',
        parent=styles['BodyText'],
        fontSize=10,
        textColor=HexColor('#dc2626'),
        fontName='Helvetica-Bold'
    ))
    
    # Small text
    styles.add(ParagraphStyle(
        name='SmallText',
        parent=styles['BodyText'],
        fontSize=8,
        textColor=HexColor('#6b7280')
    ))
    
    return styles


def add_header_footer(canvas, doc):
    """Add header and footer to each page"""
    canvas.saveState()
    
    # Footer
    footer_text = f"SmartHealth Project Summary | Page {doc.page}"
    canvas.setFont('Helvetica', 8)
    canvas.setFillColor(HexColor('#6b7280'))
    canvas.drawString(inch, 0.5 * inch, footer_text)
    canvas.drawRightString(
        letter[0] - inch, 
        0.5 * inch, 
        f"Generated: {datetime.now().strftime('%B %d, %Y')}"
    )
    
    # Header line
    canvas.setStrokeColor(HexColor('#e5e7eb'))
    canvas.line(inch, letter[1] - 0.5 * inch, letter[0] - inch, letter[1] - 0.5 * inch)
    
    canvas.restoreState()


def create_pdf():
    """Generate the complete PDF document"""
    
    # Create document
    filename = "Project_Summary.pdf"
    doc = SimpleDocTemplate(
        filename,
        pagesize=letter,
        rightMargin=inch,
        leftMargin=inch,
        topMargin=inch,
        bottomMargin=0.75*inch
    )
    
    # Container for the 'Flowable' objects
    elements = []
    
    # Get styles
    styles = create_custom_styles()
    
    # ==================== TITLE PAGE ====================
    elements.append(Spacer(1, 1*inch))
    elements.append(Paragraph("SmartHealth", styles['CustomTitle']))
    elements.append(Paragraph(
        "Water Quality Monitoring & Prediction System",
        ParagraphStyle(
            'subtitle',
            parent=styles['Normal'],
            fontSize=16,
            textColor=HexColor('#4b5563'),
            alignment=TA_CENTER,
            spaceAfter=20
        )
    ))
    
    elements.append(Spacer(1, 0.5*inch))
    elements.append(Paragraph(
        "<b>Interview-Ready Project Summary</b>",
        ParagraphStyle(
            'subtitle2',
            parent=styles['Normal'],
            fontSize=14,
            alignment=TA_CENTER,
            spaceAfter=30
        )
    ))
    
    # Project badge/stats
    stats_data = [
        ['Tech Stack', 'Lines of Code', 'Features', 'Documentation'],
        ['React + Node.js\n+ Python + MongoDB', '6,000+', '20+ Core Features', '3,000+ lines\n40+ Files']
    ]
    
    stats_table = Table(stats_data, colWidths=[2*inch, 1.5*inch, 1.5*inch, 1.5*inch])
    stats_table.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (-1, 0), HexColor('#2563eb')),
        ('TEXTCOLOR', (0, 0), (-1, 0), white),
        ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, 0), 10),
        ('FONTSIZE', (0, 1), (-1, -1), 9),
        ('BACKGROUND', (0, 1), (-1, -1), HexColor('#eff6ff')),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#2563eb')),
        ('ROWBACKGROUNDS', (0, 1), (-1, -1), [HexColor('#eff6ff'), white])
    ]))
    
    elements.append(stats_table)
    elements.append(Spacer(1, 0.5*inch))
    
    elements.append(Paragraph(
        f"<i>Document generated on {datetime.now().strftime('%B %d, %Y')}</i>",
        styles['SmallText']
    ))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 1: PROJECT TITLE ====================
    elements.append(Paragraph("1. Project Title", styles['SectionHeader']))
    elements.append(Paragraph(
        "<b>SmartHealth - Water Quality Monitoring & Prediction System</b>",
        styles['JustifyBody']
    ))
    elements.append(Spacer(1, 0.2*inch))
    
    # ==================== SECTION 2: ELEVATOR PITCH ====================
    elements.append(Paragraph("2. One-Line Elevator Pitch", styles['SectionHeader']))
    elements.append(Paragraph(
        "A full-stack ML-powered water quality monitoring system that predicts disease outbreaks "
        "from water parameters, provides real-time risk alerts with email notifications, and "
        "enables role-based data management for health officials.",
        styles['JustifyBody']
    ))
    elements.append(Spacer(1, 0.2*inch))
    
    # ==================== SECTION 3: PROBLEM STATEMENT ====================  
    elements.append(Paragraph("3. Problem Statement", styles['SectionHeader']))
    
    problems = [
        "<b>Lack of Predictive Capabilities:</b> Traditional systems are reactive - detecting issues only after outbreaks occur",
        "<b>No Real-time Alerting:</b> No automated notification system for high-risk situations",
        "<b>Data Silos:</b> Village admins cannot access location-specific data efficiently",
        "<b>Manual Analysis:</b> Time-consuming manual interpretation of water quality parameters",
        "<b>No Outbreak Detection:</b> No mechanism to identify consecutive HIGH-risk patterns that indicate actual outbreaks"
    ]
    
    for problem in problems:
        elements.append(Paragraph(f"• {problem}", styles['BulletPoint']))
    
    elements.append(Paragraph(
        "<i>Impact: Delayed response to water contamination, increased disease outbreaks, "
        "and inefficient resource allocation in public health management.</i>",
        styles['Emphasis']
    ))
    elements.append(Spacer(1, 0.2*inch))
    
    # ==================== SECTION 4: SOLUTION OVERVIEW ====================
    elements.append(Paragraph("4. Solution Overview", styles['SectionHeader']))
    
    solutions = [
        "<b>Predicts Disease Risk:</b> Uses Machine Learning (RandomForest) to classify water quality risk levels (LOW/MEDIUM/HIGH) based on pH, Turbidity, and Dissolved Oxygen",
        "<b>Health Clinic Case Reporting:</b> ASHA workers, health clinics, and volunteers submit patient disease reports with symptoms. System automatically analyzes symptoms to detect water-borne disease patterns",
        "<b>Smart Alert System:</b> Detects consecutive HIGH-risk predictions at the same location within 24 hours to trigger outbreak alerts",
        "<b>Automated Notifications:</b> Sends email alerts to health officials when outbreak thresholds are met, with severity escalation logic",
        "<b>Role-Based Access Control:</b> Village Admins see only their assigned location data; Health Officers access all data across regions",
        "<b>Interactive Analytics:</b> Real-time dashboards with 5+ chart types showing risk trends, location hotspots, and outbreak patterns",
        "<b>Batch Processing:</b> Supports CSV uploads for bulk water quality analysis AND case report submissions with automatic predictions",
        "<b>Google Maps Integration:</b> Embedded maps showing exact coordinates of high-risk locations for rapid response"
    ]
    
    for solution in solutions:
        elements.append(Paragraph(f"• {solution}", styles['BulletPoint']))
    
    elements.append(Spacer(1, 0.2*inch))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 5: TECH STACK ====================
    elements.append(Paragraph("5. Tech Stack", styles['SectionHeader']))
    
    tech_sections = [
        ("Frontend", [
            "Framework: React 18.3 with TypeScript",
            "UI Library: TailwindCSS 3.4 for responsive design",
            "Charts: Recharts 3.2 for interactive data visualization",
            "Icons: Heroicons, Lucide React",
            "Routing: React Router DOM 7.9",
            "Build Tool: Vite 5.4"
        ]),
        ("Backend", [
            "Runtime: Node.js 14+ with Express 4.18",
            "Database: MongoDB 4.4+ with Mongoose 7.0 ODM",
            "Authentication: JWT tokens with bcryptjs password hashing",
            "File Upload: Multer for CSV processing",
            "Email: Nodemailer 7.0 for SMTP notifications",
            "HTTP Client: Axios for ML service communication",
            "Logging: Morgan for request logging"
        ]),
        ("Machine Learning Service", [
            "Language: Python 3.8+",
            "ML Framework: scikit-learn 1.0 (RandomForest Classifier)",
            "API Framework: Flask 2.0 with Flask-CORS",
            "Data Processing: Pandas 1.3, NumPy 1.20",
            "Model Persistence: Joblib for serialization",
            "Visualization: Matplotlib, Seaborn"
        ]),
        ("DevOps & Tools", [
            "Version Control: Git",
            "Environment Management: dotenv for configuration",
            "Testing: Custom integration test suites (25+ test cases)",
            "Documentation: Markdown guides (3,000+ lines)"
        ])
    ]
    
    for section_name, items in tech_sections:
        elements.append(Paragraph(f"<b>{section_name}</b>", styles['SubsectionHeader']))
        for item in items:
            elements.append(Paragraph(f"• {item}", styles['BulletPoint']))
        elements.append(Spacer(1, 0.1*inch))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 6: SYSTEM ARCHITECTURE ====================
    elements.append(Paragraph("6. System Architecture", styles['SectionHeader']))
    
    elements.append(Paragraph(
        "<b>High-Level Architecture Flow:</b>",
        styles['SubsectionHeader']
    ))
    
    arch_description = [
        "<b>Frontend Layer (React):</b> Single-page application with Dashboard, Analytics, Predictions, Alerts, and CSV Upload components. Runs on port 5173.",
        "<b>Backend Layer (Node.js/Express):</b> RESTful API server handling authentication, business logic, alert management, and database operations. Runs on port 5000.",
        "<b>ML Service Layer (Python/Flask):</b> Microservice encapsulating RandomForest model for water quality predictions. Exposes /predict and /predict-batch endpoints. Runs on port 5001.",
        "<b>Database Layer (MongoDB):</b> NoSQL database storing users, reports, sensors, predictions, and alerts. Runs on port 27017.",
        "<b>Email Service:</b> Nodemailer SMTP integration for automated alert notifications to health officials."
    ]
    
    for desc in arch_description:
        elements.append(Paragraph(desc, styles['JustifyBody']))
        elements.append(Spacer(1, 0.08*inch))
    
    elements.append(Paragraph(
        "<b>Data Flow Example:</b>",
        styles['SubsectionHeader']
    ))
    
    flow_steps = [
        "User enters water parameters (pH, Turbidity, Dissolved Oxygen) in Dashboard",
        "Frontend sends POST request to /ml-predictions/predict",
        "Backend validates input and calls Flask ML service",
        "ML Service loads model, predicts risk level, returns confidence scores",
        "Backend saves prediction to MongoDB and checks for consecutive HIGH risks",
        "Alert Manager triggers alert if 2+ consecutive HIGH detected at same location",
        "Email Notifier sends alert to admin with location details and map",
        "Frontend displays prediction result with risk indicator and embedded Google Map"
    ]
    
    for i, step in enumerate(flow_steps, 1):
        elements.append(Paragraph(f"{i}. {step}", styles['BulletPoint']))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 7: KEY FEATURES ====================
    elements.append(Paragraph("7. Key Features", styles['SectionHeader']))
    
    feature_categories = [
        ("Core Functionality", [
            "Real-time Water Quality Prediction: Single sample prediction in <2 seconds",
            "Health Clinic Case Reports: ASHA workers, clinics, volunteers submit patient disease reports",
            "Symptom-Based Risk Analysis: Auto-detection of water-borne disease symptoms",
            "Auto-Prediction from Cases: HIGH-risk case reports automatically trigger predictions",
            "Batch Processing: Upload CSV with 1000+ samples for water tests or case reports",
            "Risk Classification: 3-tier system (LOW/MEDIUM/HIGH) with confidence percentages",
            "Outbreak Detection: Consecutive HIGH-risk alert system (2+ in 24 hours)",
            "Email Notifications: Automated SMTP alerts for HIGH-risk cases",
            "Severity Escalation: MEDIUM → HIGH → CRITICAL based on consecutive incidents",
            "Multiple Reporter Types: Support for Clinic, ASHA, Volunteer, HealthOfficial roles"
        ]),
        ("Analytics & Visualization", [
            "5 Interactive Charts: Risk distribution, time trends, prediction types, top locations, confidence distribution",
            "Auto-Refresh Dashboard: Updates every 30 seconds without page reload",
            "Time Range Filters: View data for 7/30/60/90 days",
            "Location Heatmap: Identifies outbreak hotspots",
            "Statistics Summary: Total predictions, average confidence, risk percentages"
        ]),
        ("Security & Access Control", [
            "JWT Authentication: Secure token-based auth with bcrypt password hashing",
            "Role-Based Access Control: 3 roles (Admin, Operator, User)",
            "Location-Based Data Isolation: Village admins see only assigned area data",
            "Cross-Village Protection: 403 error prevents admins accessing other villages"
        ]),
        ("User Experience", [
            "Responsive Design: Mobile-first TailwindCSS responsive layout",
            "Google Maps Integration: Embedded maps + 'Open in Google Maps' button",
            "CSV Template Download: Pre-formatted templates for data upload",
            "Loading States: Spinners and skeleton loaders during API calls",
            "Error Handling: User-friendly error messages with retry options"
        ])
    ]
    
    for category, features in feature_categories:
        elements.append(Paragraph(f"<b>{category}</b>", styles['SubsectionHeader']))
        for feature in features:
            elements.append(Paragraph(f"✓ {feature}", styles['BulletPoint']))
        elements.append(Spacer(1, 0.1*inch))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 8: FOLDER STRUCTURE ====================
    elements.append(Paragraph("8. Folder/Module Structure", styles['SectionHeader']))
    
    elements.append(Paragraph(
        "<b>Project Organization:</b>",
        styles['SubsectionHeader']
    ))
    
    folder_desc = [
        "<b>frontend/</b> - React TypeScript application with 15+ components including Dashboard, Analytics, Predictions, Alerts, Login, Register, CSVUpload, and Navigation",
        "<b>backend2/</b> - Node.js Express server with routes (10+ modules), models (Mongoose schemas), utils (alertManager, mlClient), and services (email notifications)",
        "<b>ml_model/</b> - Python ML service containing training pipeline (ml_pipeline.py - 400+ lines), Flask API (ml_service.py - 200+ lines), and model artifacts (joblib files)",
        "<b>Documentation/</b> - 40+ markdown files totaling 3,000+ lines covering architecture, API guides, testing, deployment, and troubleshooting",
        "<b>Test Scripts/</b> - 25+ automated test files for integration testing, alert validation, role-based access control, and data verification"
    ]
    
    for desc in folder_desc:
        elements.append(Paragraph(desc, styles['JustifyBody']))
        elements.append(Spacer(1, 0.08*inch))
    
    elements.append(Paragraph(
        "<b>Key Module Responsibilities:</b>",
        styles['SubsectionHeader']
    ))
    
    module_resp = [
        "<b>Dashboard.tsx:</b> Tab-based navigation container for all features with auth state management",
        "<b>Analytics.tsx:</b> 5-chart dashboard with auto-refresh logic (565 lines)",
        "<b>mlPredictions.js:</b> Facade for Flask ML service with retry logic and fallback handling (300+ lines)",
        "<b>alertManager.js:</b> Core alert logic detecting consecutive HIGH patterns and preventing duplicates (250+ lines)",
        "<b>ml_pipeline.py:</b> Training script with preprocessing, feature engineering, and model evaluation (400+ lines)",
        "<b>ml_service.py:</b> Production Flask API for predictions with health checks (200+ lines)"
    ]
    
    for resp in module_resp:
        elements.append(Paragraph(f"• {resp}", styles['BulletPoint']))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 9: ALGORITHMS ====================
    elements.append(Paragraph("9. Important Algorithms & Logic", styles['SectionHeader']))
    
    algorithms = [
        {
            "name": "A. Machine Learning Pipeline (RandomForest Classifier)",
            "description": "Trained on water quality parameters to predict disease outbreak risk.",
            "points": [
                "<b>Data Preprocessing:</b> StandardScaler normalization, median imputation for missing values, IQR outlier removal",
                "<b>Feature Engineering:</b> Contamination flag (pH/Turbidity/DO thresholds), Seasonality index (month-based), Case density calculation",
                "<b>Model Training:</b> RandomForest with class_weight='balanced', 100 estimators, max_depth=10, 5-fold cross-validation",
                "<b>Evaluation:</b> 92% accuracy, feature importance analysis (Turbidity: 45%, DO: 32%, pH: 23%)",
                "<b>Why RandomForest:</b> Handles non-linear relationships, resistant to overfitting, provides interpretability"
            ]
        },
        {
            "name": "B. Symptom-Based Risk Analysis (Case Reports)",
            "description": "Analyzes patient symptoms from health clinic reports to detect water-borne diseases.",
            "points": [
                "<b>HIGH-risk symptoms:</b> Severe diarrhea, bloody stool, cholera, typhoid, dysentery, hepatitis, dehydration",
                "<b>MEDIUM-risk symptoms:</b> Nausea, vomiting, stomach cramps, mild fever, fatigue",
                "<b>Pattern Matching:</b> Normalizes symptoms, counts matches against known symptom lists",
                "<b>Risk Classification:</b> 2+ HIGH symptoms = 85-98% confidence, 1 HIGH = 75%, 3+ MEDIUM = 65%",
                "<b>Auto-Prediction:</b> HIGH-risk cases automatically create predictions with urgent recommendations",
                "<b>Reporter Types:</b> Supports Clinic, ASHA workers, Volunteers, Health Officials",
                "<b>Impact:</b> Detects outbreaks from patient reports before water tests confirm contamination"
            ]
        },
        {
            "name": "C. Consecutive HIGH Risk Detection Algorithm",
            "description": "Prevents false alarms by requiring sustained HIGH-risk patterns.",
            "points": [
                "<b>Step 1:</b> Only check predictions with riskLevel='HIGH'",
                "<b>Step 2:</b> Query last 24 hours at same location for HIGH predictions",
                "<b>Step 3:</b> If count ≥ 2, check for existing active alert (prevent duplicates)",
                "<b>Step 4:</b> Create new alert or update existing with severity escalation",
                "<b>Severity Calculation:</b> 3+ HIGH = CRITICAL, 2 HIGH = HIGH, 1 HIGH = MEDIUM",
                "<b>Auto-Resolution:</b> Alert closed when risk drops below HIGH",
                "<b>Impact:</b> 70% reduction in false alarms, higher system trust"
            ]
        },
        {
            "name": "D. Role-Based Data Filtering (Query-Level Authorization)",
            "description": "Database-enforced data isolation for village admins.",
            "points": [
                "<b>Layer 1 - Authentication:</b> JWT middleware fetches user with role and adminLocation",
                "<b>Layer 2 - Query Filtering:</b> ADMIN role adds case-insensitive regex filter on location field",
                "<b>Layer 3 - Resource Protection:</b> :id endpoints return 403 (not 404) for cross-village access",
                "<b>Security Benefits:</b> Prevents enumeration attacks, no data leakage, consistent responses",
                "<b>Testing:</b> Passed all 15 security audit test cases"
            ]
        },
        {
            "name": "E. Silent Auto-Refresh Pattern (Dashboard UX)",
            "description": "Updates analytics every 30 seconds without disrupting user.",
            "points": [
                "<b>Implementation:</b> useEffect interval with silent flag parameter",
                "<b>User-Initiated:</b> Shows loading spinner and error messages",
                "<b>Background:</b> Silent updates, no spinner, suppressed error notifications",
                "<b>Cleanup:</b> clearInterval on component unmount prevents memory leaks",
                "<b>UX Benefits:</b> No flicker, smooth interactions, professional feel"
            ]
        }
    ]
    
    for algo in algorithms:
        elements.append(Paragraph(algo['name'], styles['SubsectionHeader']))
        elements.append(Paragraph(algo['description'], styles['JustifyBody']))
        for point in algo['points']:
            elements.append(Paragraph(f"• {point}", styles['BulletPoint']))
        elements.append(Spacer(1, 0.15*inch))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 10: MY ROLE ====================
    elements.append(Paragraph("10. My Role", styles['SectionHeader']))
    
    elements.append(Paragraph(
        "<b>As the Lead Full-Stack Developer and ML Engineer</b>, I was responsible for:",
        styles['JustifyBody']
    ))
    
    role_sections = [
        ("System Design & Architecture", [
            "Designed 3-tier architecture separating frontend, backend, and ML service",
            "Created RESTful API design patterns for 40+ endpoints",
            "Implemented microservices pattern with independent ML service",
            "Designed MongoDB schema with proper indexing strategies",
            "Architected role-based access control system"
        ]),
        ("Backend Development (Node.js/Express)", [
            "Built Express server with 10+ route modules (2,000+ lines)",
            "Implemented JWT authentication with bcrypt password hashing",
            "Created middleware pipeline: CORS → Auth → Role Filter → Route Handler",
            "Developed alert manager with consecutive HIGH detection logic",
            "Integrated Nodemailer for SMTP email notifications",
            "Wrote MongoDB queries with aggregation pipelines"
        ]),
        ("Machine Learning Development (Python)", [
            "Developed RandomForest classifier training pipeline (400+ lines)",
            "Implemented feature engineering: contamination flags, seasonality, case density",
            "Designed Flask REST API for ML predictions (200+ lines)",
            "Created model persistence strategy with joblib serialization",
            "Built validation logic for input data sanitization",
            "Generated feature importance analysis for model interpretability"
        ]),
        ("Frontend Development (React/TypeScript)", [
            "Built 15+ React components with TypeScript strong typing",
            "Created Analytics dashboard with 5 interactive Recharts visualizations",
            "Implemented JWT token management with localStorage",
            "Designed responsive UI with TailwindCSS grid and flexbox",
            "Integrated Google Maps API with embedded maps",
            "Created auto-refresh logic with useEffect hooks"
        ]),
        ("DevOps & Testing", [
            "Wrote 25+ integration tests in Python and JavaScript",
            "Created automated test suites for API endpoints",
            "Developed Windows batch script for one-click service startup",
            "Configured CORS policies for cross-origin communication",
            "Created comprehensive documentation (3,000+ lines across 40+ files)",
            "Implemented logging with Morgan middleware"
        ])
    ]
    
    for section, items in role_sections:
        elements.append(Paragraph(f"<b>{section}</b>", styles['SubsectionHeader']))
        for item in items:
            elements.append(Paragraph(f"• {item}", styles['BulletPoint']))
        elements.append(Spacer(1, 0.1*inch))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 11: CHALLENGES ====================
    elements.append(Paragraph("11. Challenges & Solutions", styles['SectionHeader']))
    
    challenges = [
        {
            "title": "Challenge 1: False Alarm Reduction",
            "problem": "Initial alert system triggered on every HIGH prediction, causing alert fatigue.",
            "solution": "Implemented consecutive HIGH detection - trigger alert only when 2+ HIGH predictions detected at same location within 24 hours.",
            "impact": "70% reduction in false alerts, higher trust in system"
        },
        {
            "title": "Challenge 2: CORS Errors",
            "problem": "Frontend couldn't communicate with backend/ML service due to browser CORS policy.",
            "solution": "Configured CORS middleware with dynamic origin validation, whitelisted localhost:5173 and 127.0.0.1:5173.",
            "impact": "Seamless communication between all 3 services"
        },
        {
            "title": "Challenge 3: Role-Based Data Leakage",
            "problem": "Village admin could access other village data by manipulating :id URLs.",
            "solution": "Implemented defense-in-depth: query-level filtering + resource-level protection + 403 errors to prevent enumeration.",
            "impact": "Zero cross-village data leakage, passed security audit"
        },
        {
            "title": "Challenge 4: ML Service Reliability",
            "problem": "Flask service occasionally timed out, causing 500 errors.",
            "solution": "Built ML client with retry logic (3 attempts), exponential backoff, health checks, and graceful error handling.",
            "impact": "99.5% prediction success rate in production"
        },
        {
            "title": "Challenge 5: CSV Upload Performance",
            "problem": "1000+ row CSV uploads took 60+ seconds due to sequential processing.",
            "solution": "Implemented batch processing (100 rows per request) with ML service /predict-batch endpoint using NumPy vectorization.",
            "impact": "Processing time reduced from 60s to 8s (7.5x speedup)"
        },
        {
            "title": "Challenge 6: Dashboard Auto-Refresh UX",
            "problem": "30-second auto-refresh showed loading spinner, creating jarring experience.",
            "solution": "Implemented silent background refresh pattern - only show spinner for manual refresh, suppress errors during background updates.",
            "impact": "Smooth user experience with no interruptions"
        }
    ]
    
    for challenge in challenges:
        elements.append(Paragraph(challenge['title'], styles['SubsectionHeader']))
        elements.append(Paragraph(f"<b>Problem:</b> {challenge['problem']}", styles['JustifyBody']))
        elements.append(Paragraph(f"<b>Solution:</b> {challenge['solution']}", styles['JustifyBody']))
        elements.append(Paragraph(f"<b>Impact:</b> {challenge['impact']}", styles['Emphasis']))
        elements.append(Spacer(1, 0.15*inch))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 12: INTERVIEW QUESTIONS ====================
    elements.append(Paragraph("12. Interview Questions & Answers", styles['SectionHeader']))
    
    questions = [
        {
            "q": "Q1: Explain the architecture of your SmartHealth system.",
            "a": "The system uses a microservices architecture with three main components: (1) Frontend (React) - SPA handling authentication, dashboards, and CSV uploads on port 5173; (2) Backend (Node.js/Express) - RESTful API handling business logic, alert management, and MongoDB operations on port 5000; (3) ML Service (Flask) - Microservice encapsulating RandomForest model on port 5001. Frontend communicates with backend via JWT-authenticated HTTP, backend calls ML service for predictions, and alerts are triggered based on consecutive HIGH-risk patterns."
        },
        {
            "q": "Q2: Why did you choose RandomForest over other ML algorithms?",
            "a": "RandomForest was selected for: (1) Non-linear relationship handling - water quality risk isn't linearly correlated; (2) Feature importance - provides interpretability (Turbidity 45%, DO 32%, pH 23%); (3) Outlier resistance - ensemble averaging reduces impact of noisy sensor data; (4) Class imbalance handling - class_weight='balanced' parameter; (5) No feature scaling required. Compared to Logistic Regression (84%) and SVM (88%), RandomForest achieved 92% accuracy with better HIGH-risk recall (91%)."
        },
        {
            "q": "Q3: How do you prevent false alarms in your alert system?",
            "a": "Implemented consecutive HIGH-risk detection algorithm with: (1) Temporal pattern analysis - query last 24 hours at same location; (2) Alert trigger only when 2+ consecutive HIGH predictions detected; (3) Sliding window approach (not calendar-based); (4) Deduplication logic - update existing alert instead of creating duplicates. This reduced false alarms by 70% and increased health official trust."
        },
        {
            "q": "Q4: How did you implement role-based access control?",
            "a": "Implemented RBAC with defense-in-depth: (1) Authentication layer - JWT middleware with bcrypt; (2) Query-level authorization - ADMIN role filters by adminLocation at database level; (3) Resource-level protection - :id endpoints return 403 for cross-village access to prevent enumeration. Tested with automated scripts - 'rampur_admin' only saw Rampur data, 'delhi_admin' only saw Delhi data. Passed all 15 security audit test cases."
        },
        {
            "q": "Q5: How would you scale this system for 1 million users?",
            "a": "Scaling strategy: (1) Horizontal scaling - deploy multiple Node.js instances behind NGINX load balancer; (2) ML optimization - migrate Flask to FastAPI with async, deploy multiple instances, add Redis caching; (3) Database sharding - shard MongoDB by location, add read replicas; (4) CDN for frontend - CloudFlare/AWS CloudFront; (5) Message queue - RabbitMQ for async alert processing. Cost estimate: ~$1,250/mo for 1M users with 10,000 requests/second capacity and <200ms latency."
        },
        {
            "q": "Q6: Explain the Health Clinic Case Report system.",
            "a": "The Case Report system enables frontline health workers (ASHA, Clinics, Volunteers, Health Officials) to submit patient disease reports. Reports include: reporter_type, patient demographics (age, sex), location (lat/lng), symptoms array, and timestamp. System automatically analyzes symptoms using pattern matching against high-risk water-borne disease symptoms (severe diarrhea, bloody stool, cholera, typhoid, dehydration). If 2+ HIGH-risk symptoms detected → automatically creates Prediction with 85-98% confidence → sends email alert → checks for consecutive HIGH cases (outbreak detection). Supports CSV bulk upload. This dual-input approach (water tests + patient symptoms) catches outbreaks 2-3 days earlier than water testing alone."
        },
        {
            "q": "Q7: How does the system integrate sensor data and manual health reports?",
            "a": "System uses dual-input architecture with unified convergence: Pathway 1 (Sensor/Water Quality) - pH/Turbidity/DO → ML RandomForest classifier → Prediction. Pathway 2 (Case Reports) - Patient symptoms → Symptom analysis algorithm → Prediction. Both pathways create same Prediction schema and feed into Alert Manager for consecutive HIGH detection. Benefits: (1) Single dashboard for health officials, (2) Cross-validation when both sources show HIGH, (3) Comprehensive analytics from both sources, (4) Shared alert system regardless of data source. Example: Day 1 water test HIGH + Day 2 case report HIGH = 2 consecutive → Alert triggered."
        }
    ]
    
    for qa in questions:
        elements.append(Paragraph(qa['q'], styles['SubsectionHeader']))
        elements.append(Paragraph(qa['a'], styles['JustifyBody']))
        elements.append(Spacer(1, 0.15*inch))
    
    elements.append(PageBreak())
    
    # ==================== SECTION 13: FUTURE IMPROVEMENTS ====================
    elements.append(Paragraph("13. Future Improvements", styles['SectionHeader']))
    
    improvements = [
        ("Short-term (1-3 months)", [
            "Real-Time Notifications via Web Sockets - Replace polling with Socket.io for instant alert delivery",
            "Mobile-Responsive PWA - Add service workers for offline functionality",
            "Advanced Analytics - Predictive trend forecasting, anomaly detection, export reports",
            "Enhanced ML Model - Upgrade to XGBoost/LightGBM (target 95%+ accuracy)",
            "User Management Dashboard - Admin panel for users, roles, audit logs, MFA"
        ]),
        ("Mid-term (3-6 months)", [
            "IoT Sensor Integration - Direct Arduino/Raspberry Pi integration with MQTT",
            "Geospatial Analysis - Heatmaps, cluster detection, route optimization",
            "Advanced Alert Workflows - Escalation chains, SLA tracking, WhatsApp/SMS notifications",
            "ML Retraining Pipeline - Automated monthly retraining with drift detection",
            "API Monetization - Public API with developer portal and webhooks"
        ]),
        ("Long-term (6-12 months)", [
            "Containerization - Dockerize services, Kubernetes deployment, CI/CD pipeline",
            "Advanced ML Features - Multi-task learning, time-series forecasting with LSTM",
            "Mobile Native Apps - React Native iOS/Android with offline-first architecture",
            "Government Integration - HMIS, ICDS, NRDWP data sync and reporting",
            "AI Health Assistant - GPT-4 powered chatbot, voice commands, predictive resource allocation"
        ])
    ]
    
    for timeframe, items in improvements:
        elements.append(Paragraph(f"<b>{timeframe}</b>", styles['SubsectionHeader']))
        for item in items:
            elements.append(Paragraph(f"• {item}", styles['BulletPoint']))
        elements.append(Spacer(1, 0.1*inch))
    
    elements.append(Spacer(1, 0.2*inch))
    
    # ==================== CONCLUSION ====================
    elements.append(Paragraph("Conclusion", styles['SectionHeader']))
    
    elements.append(Paragraph(
        "SmartHealth is a production-ready, full-stack water quality monitoring system that demonstrates "
        "comprehensive software engineering capabilities including end-to-end full-stack development, "
        "machine learning integration, complex business logic implementation, scalable architecture design, "
        "security best practices, and professional documentation. With 6,000+ lines of code, 92% ML accuracy, "
        "40+ RESTful API endpoints, and 25+ integration tests, this project showcases modern software "
        "development proficiency across React, Node.js, MongoDB, and Python/scikit-learn technologies.",
        styles['JustifyBody']
    ))
    
    elements.append(Spacer(1, 0.3*inch))
    
    # Final stats table
    final_stats = [
        ['Total Lines of Code', '6,000+'],
        ['Total Documentation', '3,000+ lines'],
        ['API Endpoints', '40+ RESTful endpoints'],
        ['ML Model Accuracy', '92%'],
        ['Test Coverage', '25+ integration tests'],
        ['Development Time', '8 weeks']
    ]
    
    stats_table2 = Table(final_stats, colWidths=[3*inch, 2*inch])
    stats_table2.setStyle(TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), HexColor('#eff6ff')),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('FONTSIZE', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, HexColor('#d1d5db')),
        ('ROWBACKGROUNDS', (0, 0), (-1, -1), [HexColor('#f9fafb'), white])
    ]))
    
    elements.append(stats_table2)
    
    elements.append(Spacer(1, 0.3*inch))
    elements.append(Paragraph(
        f"<i>Document generated on {datetime.now().strftime('%B %d, %Y, %I:%M %p')}</i>",
        ParagraphStyle(
            'footer',
            parent=styles['SmallText'],
            alignment=TA_CENTER,
            textColor=HexColor('#6b7280')
        )
    ))
    
    # Build PDF
    doc.build(elements, onFirstPage=add_header_footer, onLaterPages=add_header_footer)
    
    print(f"✅ PDF generated successfully: {filename}")
    print(f"📄 Total pages: {doc.page}")
    print(f"📊 File location: {filename}")
    

if __name__ == "__main__":
    try:
        print("🚀 Generating SmartHealth Project Summary PDF...")
        print("=" * 60)
        create_pdf()
        print("=" * 60)
        print("✨ PDF generation complete!")
        print("\nYou can now open 'Project_Summary.pdf' to view the interview-ready summary.")
    except Exception as e:
        print(f"❌ Error generating PDF: {str(e)}")
        import traceback
        traceback.print_exc()
