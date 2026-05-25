import { SuperViewDatabase } from "../storage/database";
import { IngestService } from "./ingest";

const db = new SuperViewDatabase();
const service = new IngestService(db);
const job = service.start(process.argv[2]);
console.log(JSON.stringify({ jobId: job.id }, null, 2));
