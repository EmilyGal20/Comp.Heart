import { useEffect, useState } from "react";
import { Alert, Table, TableBody, TableCell, TableHead, TableRow } from "@mui/material";
import { workApi } from "../api/endpoints";
import GlassPanel from "../components/GlassPanel";
import PageHeader from "../components/PageHeader";

function renderCheck(value) {
  return value ? "Yes" : "No";
}

function PermissionsPage() {
  const [matrix, setMatrix] = useState([]);
  const [error, setError] = useState("");

  useEffect(() => {
    workApi
      .permissionMatrix()
      .then((response) => {
        setMatrix(Array.isArray(response.data) ? response.data : []);
        setError("");
      })
      .catch((e) => setError(e?.response?.data?.detail || "Unable to load the permissions matrix."));
  }, []);

  return (
    <>
      <PageHeader
        eyebrow="Permissions"
        title="Role capability matrix"
        description="A clean view of who can do what across organizations, people management, tasks, planning, approvals, and audit visibility."
      />
      <GlassPanel title="Capability grid" subtitle="Server-side permissions remain the source of truth">
        {error ? <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert> : null}
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Capability</TableCell>
              <TableCell>SUPER_ADMIN</TableCell>
              <TableCell>ADMIN</TableCell>
              <TableCell>MANAGER</TableCell>
              <TableCell>USER</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {matrix.map((entry) => (
              <TableRow key={entry.capability}>
                <TableCell>{entry.capability}</TableCell>
                <TableCell>{renderCheck(entry.super_admin)}</TableCell>
                <TableCell>{renderCheck(entry.admin)}</TableCell>
                <TableCell>{renderCheck(entry.manager)}</TableCell>
                <TableCell>{renderCheck(entry.user)}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </GlassPanel>
    </>
  );
}

export default PermissionsPage;
