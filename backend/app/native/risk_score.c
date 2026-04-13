#include <stdio.h>

int task_risk_score(int hours_overdue, int priority_weight, int unread_notifications, int sla_breached) {
    int score = 10;

    if (hours_overdue > 0) {
        score += hours_overdue * 2;
    }

    score += priority_weight * 12;
    score += unread_notifications * 5;

    if (sla_breached) {
        score += 25;
    }

    if (score > 100) {
        score = 100;
    }

    if (score < 0) {
        score = 0;
    }

    return score;
}
