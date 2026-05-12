from __future__ import annotations

from queue import Empty, Queue

subscribers: list[Queue] = []


def subscribe_execution_events() -> Queue:
    queue: Queue = Queue()
    subscribers.append(queue)
    return queue


def unsubscribe_execution_events(queue: Queue) -> None:
    if queue in subscribers:
        subscribers.remove(queue)


def publish_execution_event(event: dict) -> None:
    stale: list[Queue] = []
    for queue in list(subscribers):
        try:
            queue.put_nowait(event)
        except Exception:
            stale.append(queue)
    for queue in stale:
        unsubscribe_execution_events(queue)


def drain_execution_event(queue: Queue, timeout: float = 15.0):
    try:
        return queue.get(timeout=timeout)
    except Empty:
        return None
