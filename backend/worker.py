from rq import Worker
from job_queue import queue

if __name__ == "__main__":
    worker = Worker([queue], connection=queue.connection)
    worker.work()
