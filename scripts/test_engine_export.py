import asyncio
from pathlib import Path
from apps.api.src.services.mt5_engine_service import MT5EngineService
from apps.api.src.services.mt5_pool_service import mt5_pool

async def main():
    engine = MT5EngineService()
    async with mt5_pool.lease(job_id="test_exp", timeout=60.0) as worker:
        print(f"Using worker #{worker.worker_id} at {worker.base_dir}")
        res = await engine.run_strategy_tester(
            ea_name="export_bars.ex5",
            symbol="XAUUSD",
            period="H1",
            deposit=100000,
            currency="USD",
            leverage=100,
            from_date="2024-01-01",
            to_date="2024-01-31",
            model=0,
            worker=worker,
            timeout=60,
        )
        print("Tester result:", res)

if __name__ == "__main__":
    asyncio.run(main())
