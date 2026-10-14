var DETWIL = DETWIL || {};

DETWIL.VERSION = '0.2.0-work-bundles';

DETWIL.PROJECT = Object.freeze({
  systemName: 'DETWIL',
  systemNameTh: 'DETWIL: ระบบนิเวศดิจิทัลเพื่อพัฒนาผลงานครูและนวัตกรรมการเรียนรู้',
  systemNameEn: 'Digital Ecosystem for Teacher Works and Learning Innovation',
  ownerAgency: 'สำนักงานเขตพื้นที่การศึกษามัธยมศึกษาหนองคาย',
  schoolCount: 31,
  defaultTimezone: 'Asia/Bangkok'
});

DETWIL.PROPERTY_KEYS = Object.freeze({
  SPREADSHEET_ID: 'DETWIL_SPREADSHEET_ID',
  ROOT_FOLDER_ID: 'DETWIL_ROOT_FOLDER_ID',
  WEB_APP_URL: 'DETWIL_WEB_APP_URL',
  VERCEL_BASE_URL: 'DETWIL_VERCEL_BASE_URL',
  GOOGLE_CLIENT_ID: 'DETWIL_GOOGLE_CLIENT_ID',
  PASSWORD_LOGIN_ENABLED: 'DETWIL_PASSWORD_LOGIN_ENABLED',
  PASSWORD_PEPPER: 'DETWIL_PASSWORD_PEPPER',
  PASSWORD_ITERATIONS: 'DETWIL_PASSWORD_ITERATIONS',
  MAX_UPLOAD_BYTES: 'DETWIL_MAX_UPLOAD_BYTES',
  ALLOWED_FILE_TYPES: 'DETWIL_ALLOWED_FILE_TYPES',
  CURRENT_ACADEMIC_YEAR: 'DETWIL_CURRENT_ACADEMIC_YEAR',
  CURRENT_FISCAL_YEAR: 'DETWIL_CURRENT_FISCAL_YEAR'
});

DETWIL.ROLES = Object.freeze({
  SUPER_ADMIN: 'SUPER_ADMIN',
  AREA_ADMIN: 'AREA_ADMIN',
  SUPERVISOR: 'SUPERVISOR',
  SCHOOL_ADMIN: 'SCHOOL_ADMIN',
  TEACHER: 'TEACHER',
  PUBLIC_VISITOR: 'PUBLIC_VISITOR'
});

DETWIL.AUTH_MODES = Object.freeze({
  GOOGLE: 'GOOGLE',
  PASSWORD: 'PASSWORD',
  BOTH: 'BOTH'
});

DETWIL.SHEET_NAMES = Object.freeze({
  SETTINGS: 'SETTINGS',
  WORKS: 'WORKS',
  AUTH_SESSIONS: 'AUTH_SESSIONS',
  USERS: 'USERS',
  USER_ROLES: 'USER_ROLES',
  AUTH_CREDENTIALS: 'AUTH_CREDENTIALS',
  SCHOOLS: 'SCHOOLS',
  TEACHER_PROFILES: 'TEACHER_PROFILES',
  TEACHER_PAGE_SETTINGS: 'TEACHER_PAGE_SETTINGS',
  MEDIA: 'MEDIA',
  LESSON_PLANS: 'LESSON_PLANS',
  OBEC_USAGE: 'OBEC_USAGE',
  RESEARCH: 'RESEARCH',
  FILES: 'FILES',
  REVIEWS: 'REVIEWS',
  WORKFLOW_LOG: 'WORKFLOW_LOG',
  RECORD_VERSIONS: 'RECORD_VERSIONS',
  AUDIT_LOG: 'AUDIT_LOG',
  DAILY_STATS: 'DAILY_STATS',
  NOTIFICATION_QUEUE: 'NOTIFICATION_QUEUE',
  MASTER_DATA: 'MASTER_DATA',
  IMPORT_LOG: 'IMPORT_LOG',
  SYSTEM_ERRORS: 'SYSTEM_ERRORS',
  DOCUMENT_TEMPLATES: 'DOCUMENT_TEMPLATES',
  DOCUMENT_ACTIVITIES: 'DOCUMENT_ACTIVITIES',
  DOCUMENT_RECIPIENTS: 'DOCUMENT_RECIPIENTS',
  DOCUMENT_NUMBERS: 'DOCUMENT_NUMBERS',
  ISSUED_DOCUMENTS: 'ISSUED_DOCUMENTS',
  SIGNER_SETS: 'SIGNER_SETS'
});

DETWIL.SHEET_SCHEMAS = Object.freeze({
  SETTINGS: ['SettingKey', 'SettingValue', 'ValueType', 'Description', 'IsSecret', 'UpdatedAt', 'UpdatedBy'],
  WORKS: ['WorkID', 'OwnerUserID', 'SchoolID', 'AuthorName', 'SchoolName', 'Title', 'Subject', 'GradeLevel', 'AcademicYear', 'WorkType', 'ContentJson', 'CurrentVersionID', 'VersionNo', 'ApprovalStatus', 'IsPublic', 'PublishedVersionID', 'PublishedJson', 'CreatedAt', 'UpdatedAt', 'IsDeleted'],
  AUTH_SESSIONS: ['SessionID', 'TokenHash', 'UserID', 'ExpiresAt', 'CreatedAt', 'IsDeleted'],
  USERS: ['UserID', 'Email', 'DisplayName', 'SchoolID', 'PrimaryRole', 'AccountStatus', 'CanLogin', 'AuthMode', 'PasswordLoginEnabled', 'LastLoginAt', 'LoginCount', 'StartDate', 'EndDate', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted', 'DeletedAt', 'DeletedBy'],
  USER_ROLES: ['UserRoleID', 'UserID', 'RoleCode', 'ScopeType', 'ScopeID', 'StartDate', 'EndDate', 'Status', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  AUTH_CREDENTIALS: ['CredentialID', 'UserID', 'Email', 'PasswordHash', 'PasswordSalt', 'PasswordAlgorithm', 'PasswordUpdatedAt', 'MustChangePassword', 'FailedLoginCount', 'LockedUntil', 'LastFailedLoginAt', 'LastPasswordResetAt', 'ResetBy', 'CredentialStatus', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  SCHOOLS: ['SchoolID', 'SchoolCode', 'SchoolName', 'District', 'Province', 'Network', 'DirectorName', 'CoordinatorName', 'Email', 'Phone', 'Website', 'LogoFileID', 'Status', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  TEACHER_PROFILES: ['TeacherID', 'UserID', 'SchoolID', 'ProfileSlug', 'FullName', 'Position', 'AcademicRank', 'SubjectGroup', 'Subjects', 'GradeLevels', 'EducationHistory', 'WorkHistory', 'Expertise', 'Awards', 'FeaturedWorks', 'ContactEmailPublic', 'ContactPhonePublic', 'ProfileImageFileID', 'CoverImageFileID', 'ProfileStatus', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  TEACHER_PAGE_SETTINGS: ['PageSettingID', 'TeacherID', 'UserID', 'SchoolID', 'ThemeCode', 'PrimaryColor', 'AccentColor', 'HeroStyle', 'SectionOrderJson', 'SectionVisibilityJson', 'FeaturedContentJson', 'PublicContactJson', 'IsPublic', 'ViewCount', 'QrCodeFileID', 'UpdatedAt', 'UpdatedBy'],
  MEDIA: ['MediaID', 'TeacherID', 'OwnerUserID', 'SchoolID', 'Title', 'MediaType', 'SubjectGroup', 'Subject', 'GradeLevel', 'LearningUnit', 'Standard', 'Indicator', 'Objective', 'Description', 'UsageMethod', 'TargetGroup', 'Tool', 'Result', 'Limitation', 'Keywords', 'CoverFileID', 'MainFileID', 'ExternalURL', 'VideoURL', 'AcademicYear', 'FiscalYear', 'DraftStatus', 'PublishLevel', 'ApprovalStatus', 'CurrentVersionID', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  LESSON_PLANS: ['PlanID', 'TeacherID', 'OwnerUserID', 'SchoolID', 'Title', 'SubjectCode', 'Subject', 'SubjectGroup', 'GradeLevel', 'LearningUnit', 'Topic', 'Duration', 'Semester', 'AcademicYear', 'LearningModel', 'Objectives', 'Competencies', 'Attributes', 'MediaResources', 'Assessment', 'PlanFileID', 'WorksheetFileID', 'AssessmentFileID', 'ExternalURL', 'PostTeachingNote', 'Result', 'DraftStatus', 'PublishLevel', 'ApprovalStatus', 'CurrentVersionID', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  OBEC_USAGE: ['UsageID', 'TeacherID', 'OwnerUserID', 'SchoolID', 'ContentTitle', 'ContentURL', 'ReferenceCode', 'ContentType', 'Subject', 'SubjectGroup', 'GradeLevel', 'LearningUnit', 'UsageDate', 'UsageMethod', 'StudentCount', 'Result', 'Suitability', 'Problem', 'Recommendation', 'EvidenceFileID', 'RelatedPlanID', 'DraftStatus', 'PublishLevel', 'ApprovalStatus', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  RESEARCH: ['ResearchID', 'TeacherID', 'OwnerUserID', 'SchoolID', 'Title', 'CoResearchers', 'SubjectGroup', 'Subject', 'GradeLevel', 'AcademicYear', 'Background', 'Problem', 'Objectives', 'TargetGroup', 'Variables', 'Innovation', 'Instruments', 'Methodology', 'Findings', 'Conclusion', 'Recommendations', 'Abstract', 'Keywords', 'FullReportFileID', 'EvidenceFolderID', 'ProgressStatus', 'DraftStatus', 'PublishLevel', 'ApprovalStatus', 'CurrentVersionID', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  FILES: ['FileRecordID', 'ParentType', 'ParentID', 'VersionID', 'DriveFileID', 'DriveFolderID', 'OriginalFileName', 'StoredFileName', 'MimeType', 'FileSize', 'FileHash', 'AccessLevel', 'UploadStatus', 'UploadedBy', 'UploadedAt', 'ReplacedByFileRecordID', 'IsDeleted'],
  REVIEWS: ['ReviewID', 'RecordType', 'RecordID', 'VersionID', 'ReviewLevel', 'ReviewerUserID', 'ReviewerRole', 'Decision', 'Comment', 'DueDate', 'ResolvedAt', 'CreatedAt', 'CreatedBy'],
  WORKFLOW_LOG: ['WorkflowLogID', 'RecordType', 'RecordID', 'VersionID', 'FromDraftStatus', 'ToDraftStatus', 'FromPublishLevel', 'ToPublishLevel', 'FromApprovalStatus', 'ToApprovalStatus', 'Action', 'Comment', 'ActorUserID', 'ActorRole', 'ActorSchoolID', 'CreatedAt'],
  RECORD_VERSIONS: ['VersionID', 'RecordType', 'RecordID', 'VersionNo', 'SnapshotJson', 'ChangeReason', 'VersionStatus', 'CreatedAt', 'CreatedBy'],
  AUDIT_LOG: ['AuditID', 'ActorUserID', 'ActorEmail', 'ActorRole', 'Action', 'EntityType', 'EntityID', 'Result', 'ErrorCode', 'Message', 'ClientContextJson', 'CreatedAt'],
  DAILY_STATS: ['StatsID', 'StatsDate', 'ScopeType', 'ScopeID', 'MetricKey', 'MetricValue', 'Source', 'UpdatedAt'],
  NOTIFICATION_QUEUE: ['NotificationID', 'RecipientUserID', 'RecipientEmail', 'EventType', 'RelatedType', 'RelatedID', 'Subject', 'Message', 'EmailStatus', 'RetryCount', 'LastError', 'CreatedAt', 'SentAt'],
  MASTER_DATA: ['MasterDataID', 'Category', 'Code', 'NameTh', 'NameEn', 'Description', 'SortOrder', 'Status', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  IMPORT_LOG: ['ImportID', 'ImportType', 'FileRecordID', 'RequestedBy', 'TotalRows', 'SuccessRows', 'FailedRows', 'ErrorSummary', 'Status', 'CreatedAt', 'CompletedAt'],
  SYSTEM_ERRORS: ['ErrorID', 'ErrorCode', 'ErrorLevel', 'UserMessage', 'TechnicalMessage', 'StackTraceMasked', 'EntityType', 'EntityID', 'ActorUserID', 'CreatedAt', 'ResolvedAt', 'ResolvedBy'],
  DOCUMENT_TEMPLATES: ['TemplateID', 'TemplateName', 'DocumentType', 'CanvasWidth', 'CanvasHeight', 'Unit', 'Orientation', 'BackgroundFileID', 'TemplateJson', 'PlaceholderSchemaJson', 'VersionNo', 'TemplateStatus', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  DOCUMENT_ACTIVITIES: ['ActivityID', 'ActivityName', 'ActivityType', 'TemplateID', 'SignerSetID', 'NumberRuleID', 'ScopeType', 'ScopeID', 'AcademicYear', 'FiscalYear', 'IssueDateText', 'ActivityStatus', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  DOCUMENT_RECIPIENTS: ['RecipientID', 'ActivityID', 'SourceType', 'SourceRecordID', 'RecipientName', 'RecipientPosition', 'SchoolID', 'SchoolNameSnapshot', 'AwardName', 'AchievementLevel', 'CustomFieldsJson', 'ValidationStatus', 'ValidationError', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted'],
  DOCUMENT_NUMBERS: ['DocumentNumberID', 'RuleID', 'ActivityID', 'ScopeType', 'ScopeID', 'Prefix', 'YearText', 'RunningNumber', 'NumberText', 'NumberStatus', 'ReservedBy', 'ReservedAt', 'IssuedAt', 'CancelledAt', 'VoidReason', 'ExpiresAt', 'LockBatchID'],
  ISSUED_DOCUMENTS: ['IssuedDocumentID', 'ActivityID', 'RecipientID', 'TemplateID', 'DocumentNumberID', 'DocumentNumberText', 'VerificationCode', 'VerificationUrl', 'QrCodeFileID', 'PngFileID', 'PdfFileID', 'ZipFileID', 'DocumentStatus', 'IssuedBy', 'IssuedAt', 'CancelledBy', 'CancelledAt', 'CancelReason', 'ReplacedByIssuedDocumentID', 'PrintCount', 'LastPrintedAt', 'EmailStatus'],
  SIGNER_SETS: ['SignerSetID', 'SignerSetName', 'ScopeType', 'ScopeID', 'SignerJson', 'EffectiveStartDate', 'EffectiveEndDate', 'Status', 'CreatedAt', 'CreatedBy', 'UpdatedAt', 'UpdatedBy', 'IsDeleted']
});

DETWIL.DEFAULT_SETTINGS = Object.freeze([
  ['SYSTEM_NAME', DETWIL.PROJECT.systemNameTh, 'TEXT', 'ชื่อระบบภาษาไทย', 'FALSE'],
  ['SYSTEM_NAME_EN', DETWIL.PROJECT.systemNameEn, 'TEXT', 'ชื่อระบบภาษาอังกฤษ', 'FALSE'],
  ['OWNER_AGENCY', DETWIL.PROJECT.ownerAgency, 'TEXT', 'หน่วยงานเจ้าของระบบ', 'FALSE'],
  ['SCHOOL_COUNT', String(DETWIL.PROJECT.schoolCount), 'NUMBER', 'จำนวนโรงเรียนในสังกัด', 'FALSE'],
  ['PASSWORD_LOGIN_ENABLED', 'TRUE', 'BOOLEAN', 'เปิดใช้การเข้าสู่ระบบด้วยรหัสผ่านบนชีตแบบ hash/salt', 'FALSE'],
  ['MAX_UPLOAD_BYTES', '[โปรดเติมข้อมูลจริง: ขนาดไฟล์อัปโหลดสูงสุด]', 'TEXT', 'ขนาดไฟล์สูงสุดที่อนุญาต', 'FALSE'],
  ['ALLOWED_FILE_TYPES', '[โปรดเติมข้อมูลจริง: ประเภทไฟล์ที่อนุญาต]', 'TEXT', 'ชนิดไฟล์ที่อนุญาต', 'FALSE'],
  ['CURRENT_ACADEMIC_YEAR', '[โปรดเติมข้อมูลจริง: ปีการศึกษาเริ่มต้น]', 'TEXT', 'ปีการศึกษาปัจจุบัน', 'FALSE'],
  ['CURRENT_FISCAL_YEAR', '[โปรดเติมข้อมูลจริง: ปีงบประมาณเริ่มต้น]', 'TEXT', 'ปีงบประมาณปัจจุบัน', 'FALSE']
]);
