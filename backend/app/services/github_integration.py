"""GitHub API integration for task status notifications."""

from __future__ import annotations

import re
import asyncio
from typing import Optional
import httpx

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)


def extract_github_issue_number(task_title: str) -> Optional[int]:
    """Extract GitHub issue number from task title pattern [#N]."""
    match = re.search(r'\[#(\d+)\]', task_title)
    if match:
        return int(match.group(1))
    return None


async def post_github_issue_comment(
    repo_owner: str,
    repo_name: str, 
    issue_number: int,
    comment: str
) -> bool:
    """Post a comment to a GitHub issue using the GitHub API."""
    github_pat = getattr(settings, 'github_pat', None)
    if not github_pat:
        logger.warning("No GITHUB_PAT found in settings - cannot post GitHub comment")
        return False
    
    url = f"https://api.github.com/repos/{repo_owner}/{repo_name}/issues/{issue_number}/comments"
    
    headers = {
        "Authorization": f"Bearer {github_pat}",
        "Accept": "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28"
    }
    
    data = {
        "body": comment
    }
    
    try:
        async with httpx.AsyncClient() as client:
            response = await client.post(url, headers=headers, json=data, timeout=10.0)
            
            if response.status_code == 201:
                logger.info(f"Successfully posted comment to GitHub issue {repo_owner}/{repo_name}#{issue_number}")
                return True
            else:
                logger.error(f"Failed to post GitHub comment: {response.status_code} - {response.text}")
                return False
                
    except Exception as e:
        logger.error(f"Exception posting GitHub comment: {str(e)}")
        return False


async def notify_github_task_done(
    task_title: str,
    repo_owner: str = "brettLTK", 
    repo_name: str = "royalclaw-tasks"
) -> bool:
    """
    Notify GitHub when a task is marked done.
    Extracts issue number from task title and posts a comment.
    """
    issue_number = extract_github_issue_number(task_title)
    if not issue_number:
        logger.debug(f"No GitHub issue number found in task title: {task_title}")
        return False
    
    comment = "✅ Marked done in Mission Control."
    
    return await post_github_issue_comment(
        repo_owner=repo_owner,
        repo_name=repo_name,
        issue_number=issue_number,
        comment=comment
    )