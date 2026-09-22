"""日志配置: 所有输出走一个后台线程

为什么不让主线程直接写终端: 采集任务跑在 API 进程里, DEBUG 打开时每条 SQL
都会被 echo 出来, 一轮上万行。终端一旦不再消费输出 (窗口卡住、输出缓冲满),
阻塞的 write 会把事件循环连同整轮采集一起冻住 —— 实测开发服务器就是这么挂的:
采集卡在写库中途, SQLite 写锁一直不放, API 集体无响应。

改成 enqueue=True 后, 写操作交给 loguru 的后台线程, 业务协程只往队列里丢。
SQLAlchemy 的 echo 走标准库 logging, 这里一并转发进来。
"""

import logging
import sys

from loguru import logger


class InterceptHandler(logging.Handler):
    """标准库 logging -> loguru (SQLAlchemy echo 等三方库日志都从这里过)"""

    def emit(self, record: logging.LogRecord) -> None:
        try:
            level = logger.level(record.levelname).name
        except ValueError:
            level = record.levelno
        # 定位真实调用点: loguru 的 depth 从本函数往外数, 跳过 logging 自己的
        # 中间帧和本文件, 否则日志源码位置会显示成 logging:callHandlers
        frame, depth = logging.currentframe(), 2
        while frame is not None and frame.f_code.co_filename in (
            logging.__file__,
            __file__,
        ):
            frame = frame.f_back
            depth += 1
        logger.opt(depth=depth, exception=record.exc_info).log(
            level, record.getMessage()
        )


def setup_logging() -> None:
    """接管 loguru 与标准库 logging, 统一异步写 stderr"""
    logger.remove()
    logger.add(
        sys.stderr,
        level="DEBUG",
        # 后台线程消费, 业务侧永不阻塞在终端写入上
        enqueue=True,
        backtrace=False,
        diagnose=False,
    )
    logging.basicConfig(handlers=[InterceptHandler()], level=logging.INFO, force=True)
    # SQLAlchemy 开 echo 时会往自己这个 logger 上偷偷挂一个同步 StreamHandler:
    # 那个写动作发生在事件循环里 (终端一卡就冻住整个进程), 还会和上面的转发
    # 重复输出一遍。挂个 NullHandler 占住位置, 让它老实往上传。
    logging.getLogger("sqlalchemy.engine.Engine").addHandler(logging.NullHandler())
