-- Seed Sample Data for AnkiToon
-- Run this in Supabase SQL Editor to populate sample series and vocabulary

-- Insert sample series
INSERT INTO series (
  name, 
  korean_name, 
  slug, 
  picture_url, 
  synopsis, 
  popularity, 
  genres,
  authors,
  num_chapters
) VALUES
(
  'Tower of God', 
  '신의 탑',
  'tower-of-god',
  'https://via.placeholder.com/300x400?text=Tower+of+God',
  'Reach the top of the mysterious tower and your wish will be granted.',
  9500,
  ARRAY['Action', 'Fantasy', 'Adventure'],
  ARRAY['SIU'],
  500
),
(
  'Solo Leveling',
  '나 혼자만 레벨업',
  'solo-leveling',
  'https://via.placeholder.com/300x400?text=Solo+Leveling',
  'The weakest hunter becomes the strongest through a mysterious system.',
  9800,
  ARRAY['Action', 'Fantasy'],
  ARRAY['Chugong'],
  179
),
(
  'The Breaker',
  '브레이커',
  'the-breaker',
  'https://via.placeholder.com/300x400?text=The+Breaker',
  'A weak high school student learns martial arts from a mysterious master.',
  8900,
  ARRAY['Action', 'Martial Arts'],
  ARRAY['Jeon Geuk-jin', 'Park Jin-hwan'],
  72
)
ON CONFLICT (slug) DO NOTHING;

-- Insert sample chapters for Tower of God
INSERT INTO chapters (series_id, chapter_number, title)
SELECT 
  s.id,
  1,
  'Chapter 1: The Beginning'
FROM series s
WHERE s.slug = 'tower-of-god'
ON CONFLICT (series_id, chapter_number) DO NOTHING;

INSERT INTO chapters (series_id, chapter_number, title)
SELECT 
  s.id,
  2,
  'Chapter 2: The Test'
FROM series s
WHERE s.slug = 'tower-of-god'
ON CONFLICT (series_id, chapter_number) DO NOTHING;

-- Insert sample vocabulary
INSERT INTO vocabulary (term, definition, example) VALUES
('탑', 'tower', '그는 탑에 올라갔다.'),
('시험', 'test, exam', '오늘 시험이 있어요.'),
('친구', 'friend', '제 친구를 소개합니다.'),
('사람', 'person', '좋은 사람이에요.'),
('올라가다', 'to go up, to climb', '산에 올라가요.'),
('원하다', 'to want', '뭘 원하세요?'),
('힘', 'power, strength', '힘이 세다.'),
('약하다', 'to be weak', '몸이 약해요.'),
('강하다', 'to be strong', '마음이 강하다.'),
('시작', 'beginning, start', '새로운 시작이에요.')
ON CONFLICT DO NOTHING;

-- Link vocabulary to Tower of God Chapter 1
INSERT INTO chapter_vocabulary (
  chapter_id, 
  vocabulary_id, 
  importance_score
)
SELECT 
  c.id,
  v.id,
  CASE v.term
    WHEN '탑' THEN 100
    WHEN '올라가다' THEN 90
    WHEN '시작' THEN 85
    WHEN '친구' THEN 80
    WHEN '힘' THEN 75
    ELSE 70
  END
FROM chapters c
CROSS JOIN vocabulary v
WHERE c.series_id = (
  SELECT id FROM series WHERE slug = 'tower-of-god'
)
AND c.chapter_number = 1
AND v.term IN ('탑', '시험', '친구', '올라가다', '시작', '힘')
ON CONFLICT (chapter_id, vocabulary_id) DO NOTHING;

-- Verify the data
SELECT 'Series created:', COUNT(*) FROM series;
SELECT 'Chapters created:', COUNT(*) FROM chapters;
SELECT 'Vocabulary created:', COUNT(*) FROM vocabulary;
SELECT 'Chapter vocabulary links:', COUNT(*) FROM chapter_vocabulary;

