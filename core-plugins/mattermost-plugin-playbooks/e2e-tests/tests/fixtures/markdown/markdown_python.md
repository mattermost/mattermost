```python
op.execute("""
UPDATE events.settings
SET name = 'paper_review_conditions'
WHERE module = 'editing' AND name = 'review_conditions' """)
 ```