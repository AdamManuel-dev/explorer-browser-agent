-- Create tables for browser explorer

-- Crawl sessions table
CREATE TABLE IF NOT EXISTS crawl_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    start_url VARCHAR(2048) NOT NULL,
    max_depth INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    started_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE,
    pages_crawled INTEGER DEFAULT 0,
    errors_count INTEGER DEFAULT 0,
    config JSONB,
    metadata JSONB
);

-- Pages table
CREATE TABLE IF NOT EXISTS pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES crawl_sessions(id) ON DELETE CASCADE,
    url VARCHAR(2048) NOT NULL,
    title VARCHAR(500),
    depth INTEGER NOT NULL,
    crawled_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    screenshot_path VARCHAR(500),
    content_hash VARCHAR(64),
    metadata JSONB
);

-- Interactive elements table
CREATE TABLE IF NOT EXISTS interactive_elements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    page_id UUID REFERENCES pages(id) ON DELETE CASCADE,
    element_type VARCHAR(50) NOT NULL,
    selector VARCHAR(500) NOT NULL,
    text_content TEXT,
    attributes JSONB,
    interaction_strategy VARCHAR(50),
    tested BOOLEAN DEFAULT FALSE,
    test_result JSONB
);

-- User paths table
CREATE TABLE IF NOT EXISTS user_paths (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    session_id UUID REFERENCES crawl_sessions(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    start_url VARCHAR(2048) NOT NULL,
    end_url VARCHAR(2048),
    steps_count INTEGER NOT NULL,
    duration_ms INTEGER,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    path_data JSONB NOT NULL
);

-- Generated tests table
CREATE TABLE IF NOT EXISTS generated_tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    path_id UUID REFERENCES user_paths(id) ON DELETE CASCADE,
    test_name VARCHAR(255) NOT NULL,
    file_path VARCHAR(500) NOT NULL,
    test_type VARCHAR(50) NOT NULL,
    assertions_count INTEGER DEFAULT 0,
    generated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    validation_status VARCHAR(50),
    validation_errors JSONB,
    metadata JSONB
);

-- Create indexes
CREATE INDEX idx_pages_session_id ON pages(session_id);
CREATE INDEX idx_pages_url ON pages(url);
CREATE INDEX idx_elements_page_id ON interactive_elements(page_id);
CREATE INDEX idx_elements_type ON interactive_elements(element_type);
CREATE INDEX idx_paths_session_id ON user_paths(session_id);
CREATE INDEX idx_tests_path_id ON generated_tests(path_id);
CREATE INDEX idx_sessions_status ON crawl_sessions(status);
CREATE INDEX idx_sessions_started_at ON crawl_sessions(started_at DESC);