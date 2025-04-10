import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { Task } from '@/types/task';

/**
 * Generates a PDF from the task table
 * @param element The HTML element to capture
 * @param tasks The tasks to include in the PDF
 * @param filename The name of the PDF file
 */
export async function generatePDF(element: HTMLElement, tasks: Task[], filename: string): Promise<void> {
  try {
    // Create a new PDF document
    const pdf = new jsPDF('landscape', 'mm', 'a4');
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    
    // Add title
    pdf.setFontSize(18);
    pdf.text('Project Task Plan', pageWidth / 2, 15, { align: 'center' });
    
    // Add date
    pdf.setFontSize(10);
    pdf.text(`Generated on: ${new Date().toLocaleDateString()}`, pageWidth / 2, 22, { align: 'center' });
    
    // Add task count
    pdf.text(`Total Tasks: ${tasks.length}`, pageWidth / 2, 27, { align: 'center' });
    
    // Create a temporary table for PDF generation
    const tempTable = document.createElement('div');
    tempTable.style.position = 'absolute';
    tempTable.style.left = '-9999px';
    tempTable.style.width = '1000px';
    tempTable.innerHTML = `
      <table style="width: 100%; border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px;">
        <thead>
          <tr style="background-color: #f3f4f6;">
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">SI No</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">WBS No</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Task Name</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Milestone</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Level</th>
            <th style="border: 1px solid #e5e7eb; padding: 8px; text-align: left;">Predecessors</th>
          </tr>
        </thead>
        <tbody>
          ${tasks.map(task => `
            <tr style="border-bottom: 1px solid #e5e7eb;">
              <td style="border: 1px solid #e5e7eb; padding: 8px;">${task.siNo}</td>
              <td style="border: 1px solid #e5e7eb; padding: 8px;">${task.wbsNo}</td>
              <td style="border: 1px solid #e5e7eb; padding: 8px; font-weight: ${task.level === 0 ? 'bold' : 'normal'}; padding-left: ${task.level * 10 + 8}px;">
                ${task.isMilestone ? '◆ ' : ''}${task.taskName || `<task${task.siNo}>`}
              </td>
              <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${task.isMilestone ? '✓' : ''}</td>
              <td style="border: 1px solid #e5e7eb; padding: 8px; text-align: center;">${task.level}</td>
              <td style="border: 1px solid #e5e7eb; padding: 8px;">${task.predecessorIds || ''}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
    
    document.body.appendChild(tempTable);
    
    try {
      // Capture the table as canvas
      const canvas = await html2canvas(tempTable, {
        scale: 1.5, // Higher scale for better quality
        logging: false,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      
      // Calculate the scaling to fit the page width
      const imgWidth = pageWidth - 20; // 10mm margins on each side
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      // Add the image to the PDF
      const imgData = canvas.toDataURL('image/png');
      pdf.addImage(imgData, 'PNG', 10, 35, imgWidth, imgHeight);
      
      // If the image is too tall, create additional pages
      let heightLeft = imgHeight;
      let position = 35; // Starting position
      
      while (heightLeft > 0) {
        position = heightLeft - imgHeight; // Move position for next page
        heightLeft -= (pageHeight - 40); // 40mm total margins (top + bottom)
        
        if (heightLeft > 0) {
          pdf.addPage();
          pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
        }
      }
      
      // Save the PDF
      pdf.save(filename);
    } finally {
      // Clean up
      document.body.removeChild(tempTable);
    }
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF');
  }
}